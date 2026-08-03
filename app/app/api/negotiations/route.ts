import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { mail } from "@/lib/mail";

const ROUND_TTL_MS = 24 * 60 * 60 * 1000;

// LAYOUT_UPDATE.md §6 — negociação só existe sobre Listing de revenda; venda
// primária nunca é negociável (não há botão nem rota equivalente em /events).
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!user.walletAddress) {
    return NextResponse.json({ error: "No wallet linked to account" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const { listingId, priceUsdc } = body as { listingId?: string; priceUsdc?: number };
  if (!listingId || !priceUsdc || priceUsdc <= 0) {
    return NextResponse.json({ error: "listingId and priceUsdc (> 0) are required" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { ticket: { include: { event: true } } },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.status !== "ACTIVE") {
    return NextResponse.json({ error: "Listing is not active" }, { status: 409 });
  }
  if (listing.sellerAddress.toLowerCase() === user.walletAddress.toLowerCase()) {
    return NextResponse.json({ error: "Cannot negotiate your own listing" }, { status: 409 });
  }

  // Teto de revenda (§5.5) vale para a oferta também — sem isso, negociação
  // vira um jeito de furar o teto oferecendo alto e o vendedor aceitando.
  const isCollectible = listing.ticket.event.eventDate.getTime() < Date.now();
  if (!isCollectible && listing.ticket.event.maxResaleBps) {
    const cap = (Number(listing.ticket.facePrice) * listing.ticket.event.maxResaleBps) / 10000;
    if (priceUsdc > cap + 1e-9) {
      return NextResponse.json({ error: `Offer exceeds the resale cap of ${cap.toFixed(2)} USDC` }, { status: 409 });
    }
  }

  const existing = await prisma.negotiation.findUnique({
    where: { listingId_buyerUserId: { listingId, buyerUserId: user.id } },
  });
  if (existing && existing.status === "OPEN") {
    return NextResponse.json({ error: "You already have an open negotiation for this listing" }, { status: 409 });
  }
  if (existing && existing.status === "ACCEPTED") {
    return NextResponse.json({ error: "Negotiation already accepted" }, { status: 409 });
  }

  // Reabrir (§6.2 "esgotadas as 3 rodadas... o comprador pode abrir uma
  // nova") reaproveita a linha existente em vez de criar outra — a unique
  // constraint (listingId, buyerUserId) é deliberadamente uma thread por par.
  const expiresAt = new Date(Date.now() + ROUND_TTL_MS);
  const negotiation = existing
    ? await prisma.negotiation.update({
        where: { id: existing.id },
        data: { status: "OPEN", turn: "SELLER", roundCount: 1, agreedPrice: null, expiresAt },
      })
    : await prisma.negotiation.create({
        data: { listingId, buyerUserId: user.id, status: "OPEN", turn: "SELLER", roundCount: 1, expiresAt },
      });

  await prisma.negotiationRound.create({
    data: { negotiationId: negotiation.id, roundNumber: 1, author: "BUYER", priceUsdc },
  });

  const seller = await prisma.user.findFirst({ where: { walletAddress: listing.sellerAddress } });
  if (seller?.email) {
    await mail.send({
      to: seller.email,
      subject: "Você recebeu uma proposta de compra",
      body: `Alguém ofereceu ${priceUsdc.toFixed(2)} USDC pelo seu ingresso de "${listing.ticket.event.title}". Responda em até 24h.`,
    });
  }

  return NextResponse.json({ ok: true, negotiationId: negotiation.id }, { status: 201 });
}

// GET /api/negotiations — minhas negociações, como comprador e como vendedor.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  // Expiração preguiçosa (§6.2): checa antes de listar, não depende de job.
  await prisma.negotiation.updateMany({
    where: { status: "OPEN", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  const asBuyer = await prisma.negotiation.findMany({
    where: { buyerUserId: user.id },
    include: { rounds: { orderBy: { roundNumber: "asc" } }, listing: { include: { ticket: { include: { event: true } } } } },
    orderBy: { updatedAt: "desc" },
  });

  const asSeller = user.walletAddress
    ? await prisma.negotiation.findMany({
        where: { listing: { sellerAddress: user.walletAddress } },
        include: { rounds: { orderBy: { roundNumber: "asc" } }, listing: { include: { ticket: { include: { event: true } } } } },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const shape = (n: (typeof asBuyer)[number]) => ({
    id: n.id,
    listingId: n.listingId,
    status: n.status,
    turn: n.turn,
    roundCount: n.roundCount,
    expiresAt: n.expiresAt,
    agreedPrice: n.agreedPrice ? Number(n.agreedPrice) : null,
    eventTitle: n.listing.ticket.event.title,
    tokenId: n.listing.tokenId,
    rounds: n.rounds.map((r) => ({ roundNumber: r.roundNumber, author: r.author, priceUsdc: Number(r.priceUsdc), createdAt: r.createdAt })),
  });

  return NextResponse.json({
    asBuyer: asBuyer.map(shape),
    asSeller: asSeller.map(shape),
  });
}
