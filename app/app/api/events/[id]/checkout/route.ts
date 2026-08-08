import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { lockRate } from "@/lib/fx";
import { psp } from "@/lib/psp";
import { resolveGiftRecipient } from "@/lib/giftRecipient";
import { socialHalfCap } from "@/lib/socialHalfQuota";
import { hardCapAvailability, loadCapacityUsage, publicAvailability } from "@/lib/availability";
import { randomUUID } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id: eventId } = await params;

  const event = await prisma.event.findUnique({
    where:   { id: eventId },
    // PLANO_EVOLUCAO_V2.md §5.1 — nesta fatia todo evento tem exatamente um
    // TicketType (criado junto do evento em POST /api/organizer/events); o
    // checkout compra sempre esse. Quando a UI de matriz existir, o tipo passa
    // a vir do corpo da requisição em vez de ser resolvido aqui.
    include: { ticketTypes: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.status !== "ON_SALE") {
    return NextResponse.json({ error: "Event is not on sale" }, { status: 409 });
  }
  if (event.onchainEventId === null) {
    return NextResponse.json({ error: "Event not deployed on-chain yet" }, { status: 409 });
  }
  const ticketType = event.ticketTypes[0];
  if (!ticketType || ticketType.onchainTypeId === null) {
    return NextResponse.json({ error: "Event ticket type not deployed on-chain yet" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const method: string = body.method ?? "PIX";
  const giftRecipient: string | undefined = body.giftRecipient || undefined;
  const useReservedAllocation: boolean = body.useReservedAllocation === true;
  const isHalfPrice: boolean = body.isHalfPrice === true;

  // Meia-entrada — PLANO_EVOLUCAO_V2.md D24. Só existe se o organizador optou
  // (hasSocialHalf); nominal e sem upload de comprovante nesta fatia — a
  // exigência de apresentar o documento na portaria é operação de check-in,
  // não do checkout.
  if (isHalfPrice && !event.hasSocialHalf) {
    return NextResponse.json({ error: "Este evento não tem meia-entrada" }, { status: 409 });
  }

  if (!["PIX", "CARD", "USDC"].includes(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  // buyer must have a wallet (created by Privy on first login)
  if (!user.walletAddress) {
    return NextResponse.json({ error: "No wallet linked to account" }, { status: 409 });
  }

  // LAYOUT_UPDATE.md §5.6.1 — identificação (CPF) exigida na 1a compra.
  if (!user.cpf) {
    return NextResponse.json({ error: "Identification required", code: "IDENTIFICATION_REQUIRED" }, { status: 403 });
  }

  // Presente — PLANO_EVOLUCAO_V2.md D18. Decisão: destinatário precisa já ter
  // conta (sem provisionar carteira Privy antecipada). Resolve pra User.id;
  // se não vier giftRecipient, o ingresso vai pra quem está pagando mesmo.
  let recipientUserId = user.id;
  if (giftRecipient) {
    const resolved = await resolveGiftRecipient(giftRecipient);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error, code: resolved.code }, { status: 404 });
    }
    recipientUserId = resolved.recipient.id;
  }

  // Reserva do organizador — PLANO_EVOLUCAO_V2.md D19, revisado por §10.5/D40.
  // Só o próprio organizador do evento pode consumir a própria cota, e só faz
  // sentido presenteando alguém (senão não é "reserva", é a compra normal
  // dele). O check de cota (reservedTicketsAssigned < reservedTickets) só
  // vale quando o evento TEM teto — reservedTickets é, por definição, uma
  // fração de uma oferta finita; sem maxTickets não existe cota a esgotar, e
  // nomear um beneficiário (bancar o mint de alguém) continua fazendo
  // sentido mesmo assim. Antes disto, a exigência de maxTickets aqui era
  // efeito colateral da implementação, não decisão de produto.
  if (useReservedAllocation) {
    if (!giftRecipient) {
      return NextResponse.json({ error: "Reserva exige um destinatário (giftRecipient)" }, { status: 400 });
    }
    const organizer = await prisma.organizer.findUnique({ where: { id: event.organizerId } });
    if (!organizer || organizer.userId !== user.id) return unauthorized();
    if (event.maxTickets !== null && event.reservedTicketsAssigned >= event.reservedTickets) {
      return NextResponse.json({ error: "Sem cota reservada disponível para este evento" }, { status: 409 });
    }
  }

  // Capacity check: minted tickets + in-flight purchases + códigos pendentes
  // não podem exceder maxTickets. O contrato on-chain é a guarda final, mas
  // checar aqui evita cobrar um comprador por um ingresso que reverteria no
  // mint. null maxTickets = ilimitado. PLANO_EVOLUCAO_V2.md §10.6/D42 — fonte
  // única (lib/availability.ts), pra exibição e checkout nunca mais divergir.
  //
  // Alocação reservada usa só o teto real (hardCapAvailability) — é exatamente
  // pra isso que a cota foi separada. Compra pública usa publicAvailability,
  // que desconta a reserva ainda não usada, senão a reserva não protegeria nada.
  if (event.maxTickets !== null) {
    const usage = await loadCapacityUsage(eventId, event);
    const hardCapLeft = hardCapAvailability(event, usage);
    if (hardCapLeft !== null && hardCapLeft <= 0) {
      return NextResponse.json({ error: "Event is sold out" }, { status: 409 });
    }
    if (!useReservedAllocation) {
      const publicLeft = publicAvailability(event, usage);
      if (publicLeft !== null && publicLeft <= 0) {
        return NextResponse.json({ error: "Event is sold out" }, { status: 409 });
      }
    }
  }

  // Cota de meia — PLANO_EVOLUCAO_V2.md D24. Mesmo par sold+inFlight do check
  // de capacidade acima, mas contando só unidades de meia — o teto de meia é
  // uma fração do teto geral, não do que já vendeu no total.
  if (isHalfPrice) {
    const cap = socialHalfCap(event);
    if (cap !== null) {
      const [soldHalf, inFlightHalf] = await Promise.all([
        prisma.ticket.count({ where: { eventId, isHalfPrice: true } }),
        prisma.purchase.count({
          where: { eventId, listingId: null, isHalfPrice: true, status: { in: ["PENDING", "PAID", "MINTING"] } },
        }),
      ]);
      if (soldHalf + inFlightHalf >= cap) {
        return NextResponse.json({ error: "Cota de meia-entrada esgotada para este evento" }, { status: 409 });
      }
    }
  }

  // Preço cheio mesmo na alocação reservada — o contrato (buyTicketFor) sempre
  // paga ao organizador (ticketPrice − taxa) via pendingWithdrawals; cobrar só
  // a taxa aqui faria a tesouraria adiantar o resto sem nunca reaver. O "só
  // paga a taxa" da reserva acontece em termos líquidos: o organizador recebe
  // de volta a própria parte quando sacar o payout do evento.
  const priceUsdc = isHalfPrice ? Number(ticketType.priceUsdc) / 2 : Number(ticketType.priceUsdc);
  const fxRate    = await lockRate();
  const amountBrl = Math.round(priceUsdc * fxRate * 100) / 100;

  const externalRef = randomUUID();

  if (method === "PIX" || method === "CARD") {
    const charge = await psp.createPixCharge(amountBrl, externalRef);

    const purchase = await prisma.purchase.create({
      data: {
        userId:        user.id,
        recipientUserId,
        eventId,
        ticketTypeId:  ticketType.id,
        amountBrl,
        amountUsdc:    priceUsdc,
        fxRate,
        pspProvider:   process.env.PSP_PROVIDER ?? "mock",
        pspChargeId:   charge.chargeId,
        paymentMethod: method as "PIX" | "CARD",
        status:        "PENDING",
        isReservedAllocation: useReservedAllocation,
        isHalfPrice:   isHalfPrice,
      },
    });

    return NextResponse.json({
      purchaseId:  purchase.id,
      status:      "PENDING",
      amountBrl,
      pixCode:     charge.pixCode,
      qrCodeUrl:   charge.qrCodeUrl,
      expiresAt:   charge.expiresAt,
    });
  }

  // USDC direct flow — return unsigned tx for the user's wallet to sign
  return NextResponse.json({
    message: "USDC direct flow not yet implemented (Phase 1 scope: fiat only)",
  }, { status: 501 });
}
