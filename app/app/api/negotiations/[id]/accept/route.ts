import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { resolveNegotiationAction } from "@/lib/negotiations";
import { lockListingOnChain } from "@/lib/onchain";
import { mail } from "@/lib/mail";

// LAYOUT_UPDATE.md §6.3/§6.4 — o ponto mais delicado do documento.
// 1) Marca esta negociação ACCEPTED e todas as concorrentes (outros
//    compradores no mesmo listing) SUPERSEDED, na MESMA transação — travar
//    primeiro e cancelar depois deixaria janela para dois aceites concorrentes.
// 2) Só então trava on-chain (lockListing), o que também impede
//    buyListedTicket direto no contrato por cima do acordo (§6.4).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const { error, negotiation } = await resolveNegotiationAction(id, user, true);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const listing = negotiation!.listing;
  const lastRound = negotiation!.rounds[0];
  if (!lastRound) return NextResponse.json({ error: "No offer to accept" }, { status: 409 });
  if (listing.onchainListingId === null) {
    return NextResponse.json({ error: "Listing not confirmed on-chain" }, { status: 409 });
  }

  const buyer = await prisma.user.findUnique({ where: { id: negotiation!.buyerUserId } });
  if (!buyer?.walletAddress) {
    return NextResponse.json({ error: "Buyer has no wallet" }, { status: 409 });
  }

  const agreedPrice = lastRound.priceUsdc;

  let reserved: { supersededIds: string[] };
  try {
    reserved = await prisma.$transaction(async (tx) => {
      // Relê o listing dentro da transação — se já não estiver ACTIVE, outro
      // aceite ou uma compra direta já andou; falha limpo em vez de vender fantasma.
      const freshListing = await tx.listing.findUnique({ where: { id: listing.id } });
      if (!freshListing || freshListing.status !== "ACTIVE") {
        throw new Error("LISTING_UNAVAILABLE");
      }

      const superseded = await tx.negotiation.findMany({
        where: { listingId: listing.id, status: "OPEN", id: { not: id } },
        select: { id: true },
      });

      await tx.negotiation.update({
        where: { id },
        data: { status: "ACCEPTED", agreedPrice },
      });
      if (superseded.length > 0) {
        await tx.negotiation.updateMany({
          where: { id: { in: superseded.map((s) => s.id) } },
          data: { status: "SUPERSEDED" },
        });
      }
      await tx.listing.update({ where: { id: listing.id }, data: { status: "LOCKED" } });

      return { supersededIds: superseded.map((s) => s.id) };
    });
  } catch (err) {
    if (err instanceof Error && err.message === "LISTING_UNAVAILABLE") {
      return NextResponse.json({ error: "Listing is no longer available" }, { status: 409 });
    }
    throw err;
  }

  try {
    await lockListingOnChain(listing.onchainListingId, buyer.walletAddress as `0x${string}`);
  } catch (err) {
    console.error("[negotiations/accept] lockListing failed:", err);
    // Reverte a reserva — as concorrentes ficam SUPERSEDED (decisão consciente:
    // reabri-las automaticamente exigiria mais estado do que vale a pena para
    // uma falha de rede pontual; o comprador pode reabrir manualmente).
    await prisma.$transaction([
      prisma.listing.updateMany({ where: { id: listing.id, status: "LOCKED" }, data: { status: "ACTIVE" } }),
      prisma.negotiation.update({ where: { id }, data: { status: "OPEN", agreedPrice: null } }),
    ]);
    return NextResponse.json({ error: "Failed to lock listing on-chain" }, { status: 500 });
  }

  const seller = await prisma.user.findFirst({ where: { walletAddress: listing.sellerAddress } });
  await Promise.all([
    buyer.email ? mail.send({
      to: buyer.email,
      subject: "Proposta aceita!",
      body: `Sua oferta de ${agreedPrice.toString()} USDC foi aceita. Finalize o pagamento para garantir o ingresso.`,
    }) : Promise.resolve(),
    seller?.email ? mail.send({
      to: seller.email,
      subject: "Você aceitou uma proposta",
      body: `Negociação fechada em ${agreedPrice.toString()} USDC. O comprador tem até o vencimento do anúncio para pagar.`,
    }) : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true, agreedPrice: Number(agreedPrice), supersededCount: reserved.supersededIds.length });
}
