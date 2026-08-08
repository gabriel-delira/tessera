import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { psp } from "@/lib/psp";
import { buyTicketOnChain, settleListedTicketOnChain, buyListedTicketForOnChain, unlockListingOnChain, getOnchainTicketNumber } from "@/lib/onchain";
import { computeResaleSplit } from "@/lib/split";

// Shared handler — receives a charge_id + status and drives the purchase state machine.
export async function processPspPayment(chargeId: string): Promise<{ ok: boolean; message: string }> {
  // Atomic idempotency: claim the purchase in a single write — only succeeds if it is
  // still PENDING.  Concurrent webhooks for the same charge_id both try this; exactly
  // one wins (count === 1) and the other returns early without a second mint/settle.
  const claimed = await prisma.purchase.updateMany({
    where: { pspChargeId: chargeId, status: "PENDING" },
    data:  { status: "PAID", paidAt: new Date() },
  });

  if (claimed.count !== 1) {
    const existing = await prisma.purchase.findUnique({ where: { pspChargeId: chargeId } });
    if (!existing) return { ok: false, message: "Purchase not found" };
    if (existing.status === "COMPLETED" || existing.status === "REFUNDED") {
      return { ok: true, message: `Already ${existing.status}` };
    }
    return { ok: false, message: `Unexpected status: ${existing.status}` };
  }

  const purchase = await prisma.purchase.findUnique({
    where: { pspChargeId: chargeId },
    include: {
      event:      true,
      ticketType: true,
      user:       true,
      recipient:  true,
      listing:    true,
    },
  });

  if (!purchase) return { ok: false, message: "Purchase not found after claim" };

  // Presente (D18) — o NFT vai pra carteira do destinatário, não de quem
  // pagou. Sem giftRecipient no checkout, recipientUserId === userId, então
  // `purchase.recipient` já é o comprador de qualquer forma.
  const recipientWallet = purchase.recipient?.walletAddress ?? purchase.user.walletAddress;
  if (!recipientWallet) {
    await triggerRefund(purchase.id, purchase.pspChargeId, Number(purchase.amountBrl), purchase.listing?.onchainListingId ?? null);
    return { ok: false, message: "Buyer has no wallet; refunded" };
  }

  // ── Resale flow ───────────────────────────────────────────────────────────────
  if (purchase.listingId && purchase.listing) {
    const listing = purchase.listing;
    const event = purchase.event;

    if (listing.onchainListingId === null) {
      await triggerRefund(purchase.id, purchase.pspChargeId, Number(purchase.amountBrl), null);
      return { ok: false, message: "Listing not confirmed on-chain; refunded" };
    }

    await prisma.purchase.update({ where: { id: purchase.id }, data: { status: "MINTING" } });

    // LAYOUT_UPDATE.md §6.4 — se houver negociação aceita para este listing/comprador,
    // o preço acordado prevalece sobre o preço do anúncio. Sem negociação, é o preço do
    // anúncio mesmo (agreedPrice sempre existe, nunca é opcional).
    const acceptedNegotiation = await prisma.negotiation.findFirst({
      where: { listingId: listing.id, buyerUserId: purchase.userId, status: "ACCEPTED", agreedPrice: { not: null } },
    });
    const agreedPriceUsdc = acceptedNegotiation?.agreedPrice
      ? Number(acceptedNegotiation.agreedPrice)
      : Number(listing.price);

    const sellerUser = await prisma.user.findFirst({ where: { walletAddress: listing.sellerAddress } });
    const organizer  = await prisma.organizer.findUnique({ where: { id: event.organizerId } });

    // Fluxo Cripto só é possível sem preço negociado — o contrato paga l.price,
    // não tem como honrar um agreedPrice diferente (§6.4). Com negociação
    // aceita, cai para o Fluxo Reais mesmo que a preferência seja CRYPTO.
    const useCryptoFlow = sellerUser?.payoutMethod === "CRYPTO" && !acceptedNegotiation;

    try {
      let txHash: `0x${string}`;
      const ledgerWrites = [];

      if (useCryptoFlow) {
        // Split acontece dentro do contrato — vendedor e RoyaltySplitter do
        // evento recebem USDC diretamente. Nenhum crédito de ledger aqui: o
        // dinheiro já chegou, não é "a receber".
        txHash = await buyListedTicketForOnChain(listing.onchainListingId, recipientWallet as `0x${string}`);
      } else {
        txHash = await settleListedTicketOnChain(
          listing.onchainListingId,
          recipientWallet as `0x${string}`,
          agreedPriceUsdc
        );

        // Split — LAYOUT_UPDATE.md §5.7: no Fluxo Reais o dinheiro não passa
        // pelo contrato, então o repasse acontece aqui, refletido no ledger.
        // O atestado on-chain gravado no evento TicketSettled é o que permite
        // ao organizador conferir esses mesmos números depois (§5.7.2).
        const split = computeResaleSplit({
          amount:             Number(purchase.amountBrl),
          platformFeeBps:     event.platformFeeBps,
          royaltyBps:         event.royaltyBps,
          royaltyOrgShareBps: event.royaltyOrgShareBps,
        });

        if (sellerUser) {
          ledgerWrites.push(
            prisma.ledgerEntry.create({
              data: {
                userId:      sellerUser.id,
                type:        "RESALE_PAYOUT",
                amountBrl:   split.sellerShare,
                description: `Revenda — ${event.title} (ingresso #${listing.tokenId})`,
                purchaseId:  purchase.id,
                onchainTxHash: txHash,
              },
            })
          );
        }
        if (organizer && split.organizerRoyalty > 0) {
          ledgerWrites.push(
            prisma.ledgerEntry.create({
              data: {
                userId:      organizer.userId,
                type:        "ROYALTY_PAYOUT",
                amountBrl:   split.organizerRoyalty,
                description: `Royalty de revenda — ${event.title} (ingresso #${listing.tokenId})`,
                purchaseId:  purchase.id,
                onchainTxHash: txHash,
              },
            })
          );
        }
      }

      await prisma.$transaction([
        prisma.listing.update({ where: { id: listing.id }, data: { status: "SOLD" } }),
        prisma.ticket.update({
          where: { tokenId: listing.tokenId },
          data:  { ownerAddress: recipientWallet, status: "VALID" },
        }),
        prisma.purchase.update({
          where: { id: purchase.id },
          data:  { status: "COMPLETED", tokenId: listing.tokenId, mintTxHash: txHash, completedAt: new Date() },
        }),
        ...ledgerWrites,
      ]);

      return { ok: true, message: `Resale settled — ticket ${listing.tokenId} transferred to buyer` };
    } catch (err) {
      console.error("[PSP webhook] settleListedTicket failed:", err);
      await triggerRefund(purchase.id, purchase.pspChargeId, Number(purchase.amountBrl), listing.onchainListingId);
      return { ok: false, message: "On-chain settle failed; refunded" };
    }
  }

  // ── Primary sale flow ─────────────────────────────────────────────────────────
  const event = purchase.event;

  if (event.onchainEventId === null) {
    await triggerRefund(purchase.id, purchase.pspChargeId, Number(purchase.amountBrl), null);
    return { ok: false, message: "Event not deployed on-chain; refunded" };
  }
  const ticketType = purchase.ticketType;
  if (!ticketType || ticketType.onchainTypeId === null) {
    // Não deveria acontecer: o checkout (§5.1) só cria a Purchase depois de
    // confirmar que o TicketType tem onchainTypeId. Se chegou aqui mesmo assim,
    // é mais seguro reembolsar do que adivinhar um typeId.
    await triggerRefund(purchase.id, purchase.pspChargeId, Number(purchase.amountBrl), null);
    return { ok: false, message: "Ticket type not deployed on-chain; refunded" };
  }
  const onchainTypeId = ticketType.onchainTypeId;

  // Mark MINTING
  await prisma.purchase.update({
    where: { id: purchase.id },
    data:  { status: "MINTING" },
  });

  try {
    const { txHash, tokenId } = await buyTicketOnChain(
      event.onchainEventId,
      onchainTypeId,
      recipientWallet as `0x${string}`
    );

    // Authoritative ticket number from on-chain mint data (race-free; the DB
    // count()+1 could collide with the indexer safety-net or concurrent mints).
    const ticketNumber = await getOnchainTicketNumber(tokenId);

    await prisma.$transaction([
      prisma.ticket.create({
        data: {
          tokenId,
          eventId:      event.id,
          ticketTypeId: ticketType.id,
          ownerAddress: recipientWallet,
          ticketNumber,
          facePrice:    purchase.amountUsdc,
          status:       "VALID",
          mintTxHash:   txHash,
          mintedAt:     new Date(),
          isHalfPrice:  purchase.isHalfPrice,
        },
      }),
      prisma.purchase.update({
        where: { id: purchase.id },
        data:  { status: "COMPLETED", tokenId, mintTxHash: txHash, completedAt: new Date() },
      }),
      // D19 — consome a cota reservada só agora que o mint confirmou; se o
      // pagamento falhar antes daqui, a cota nunca foi tocada.
      ...(purchase.isReservedAllocation
        ? [prisma.event.update({ where: { id: event.id }, data: { reservedTicketsAssigned: { increment: 1 } } })]
        : []),
    ]);

    return { ok: true, message: `Minted tokenId ${tokenId}` };
  } catch (err) {
    console.error("[PSP webhook] buyTicketFor failed:", err);
    await triggerRefund(purchase.id, purchase.pspChargeId, Number(purchase.amountBrl), null);
    return { ok: false, message: "On-chain purchase failed; refunded" };
  }
}

async function triggerRefund(
  purchaseId: string,
  chargeId: string,
  amountBrl: number,
  onchainListingId: number | null
) {
  await prisma.purchase.update({
    where: { id: purchaseId },
    data:  { status: "REFUNDING" },
  });
  // Unlock the listing so the seller can cancel or relist, and release the DB
  // reservation (LOCKED → ACTIVE) so other buyers can check out again.
  if (onchainListingId !== null) {
    try {
      await unlockListingOnChain(onchainListingId);
    } catch (err) {
      console.error("[PSP webhook] unlockListing failed:", err);
    }
    await prisma.listing.updateMany({
      where: { onchainListingId, status: "LOCKED" },
      data:  { status: "ACTIVE" },
    });
  }
  try {
    await psp.refund(chargeId, amountBrl);
    await prisma.purchase.update({
      where: { id: purchaseId },
      data:  { status: "REFUNDED" },
    });
  } catch (err) {
    console.error("[PSP webhook] refund failed:", err);
    await prisma.purchase.update({
      where: { id: purchaseId },
      data:  { status: "FAILED" },
    });
  }
}

// ── POST /api/webhooks/psp ────────────────────────────────────────────────────
// PSP sends: { charge_id: string, status: "paid" | "failed" | ... }
// The raw body is read first and its signature verified before any processing —
// this endpoint drives on-chain mint/settle, so an unauthenticated call would let
// anyone mint/transfer tickets without paying.

export async function POST(req: NextRequest) {
  // Read the RAW body for signature verification — do NOT use req.json() first,
  // as re-serializing would change the bytes the HMAC was computed over.
  const rawBody = await req.text();

  if (!psp.verifyWebhook(rawBody, req.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { charge_id?: string; status?: string } | null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }

  if (!body?.charge_id) {
    return NextResponse.json({ error: "Missing charge_id" }, { status: 400 });
  }

  if (body.status !== "paid") {
    // ignore non-paid events for now
    return NextResponse.json({ ok: true, skipped: true });
  }

  const result = await processPspPayment(body.charge_id as string);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
