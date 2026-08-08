import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { resolveNegotiationAction, MAX_ROUNDS, ROUND_TTL_MS } from "@/lib/negotiations";
import { mail } from "@/lib/mail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { priceUsdc } = body as { priceUsdc?: number };
  if (!priceUsdc || priceUsdc <= 0) {
    return NextResponse.json({ error: "priceUsdc (> 0) is required" }, { status: 400 });
  }

  const { error, negotiation, role } = await resolveNegotiationAction(id, user, true);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  // LAYOUT_UPDATE.md §6.2 — teto de 3 rodadas. Na 3a, só resta aceitar ou recusar.
  if (negotiation!.roundCount >= MAX_ROUNDS) {
    return NextResponse.json({ error: "Round limit reached — accept or decline" }, { status: 409 });
  }

  // §5.5 armadilha 12 — contraproposta do vendedor pode subir o preço; validar
  // contra o teto no aceite/contraproposta, não só na abertura.
  const listing = negotiation!.listing;
  // endDate, não eventDate — PLANO_EVOLUCAO_V2.md §10.1/D35.
  const isCollectible = listing.ticket.event.endDate.getTime() < Date.now();
  if (role === "SELLER" && !isCollectible && listing.ticket.event.maxResaleBps) {
    const cap = (Number(listing.ticket.facePrice) * listing.ticket.event.maxResaleBps) / 10000;
    if (priceUsdc > cap + 1e-9) {
      return NextResponse.json({ error: `Counter-offer exceeds the resale cap of ${cap.toFixed(2)} USDC` }, { status: 409 });
    }
  }

  const nextRound = negotiation!.roundCount + 1;
  const nextTurn = role === "BUYER" ? "SELLER" : "BUYER";

  await prisma.$transaction([
    prisma.negotiation.update({
      where: { id },
      data: { turn: nextTurn, roundCount: nextRound, expiresAt: new Date(Date.now() + ROUND_TTL_MS) },
    }),
    prisma.negotiationRound.create({
      data: { negotiationId: id, roundNumber: nextRound, author: role!, priceUsdc },
    }),
  ]);

  const counterpartyUser = role === "BUYER"
    ? await prisma.user.findFirst({ where: { walletAddress: listing.sellerAddress } })
    : await prisma.user.findUnique({ where: { id: negotiation!.buyerUserId } });
  if (counterpartyUser?.email) {
    await mail.send({
      to: counterpartyUser.email,
      subject: "Você recebeu uma contraproposta",
      body: `Nova oferta de ${priceUsdc.toFixed(2)} USDC pelo ingresso de "${listing.ticket.event.title}". Responda em até 24h.`,
    });
  }

  return NextResponse.json({ ok: true, roundCount: nextRound });
}
