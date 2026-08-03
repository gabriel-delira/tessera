import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";

// PLANO_EVOLUCAO_V2.md §4.4 — métricas por evento na tabela do organizador.
// Tudo agregado em queries próprias (groupBy/reduce), nunca uma query por
// evento no cliente: com dezenas de eventos isso vira N+1 rapidinho.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const events = await prisma.event.findMany({
    where: { organizerId: organizer.id },
    include: {
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const eventIds = events.map((e) => e.id);
  if (eventIds.length === 0) return NextResponse.json({ events: [] });

  const [checkinCounts, primarySales, resaleSales, royaltyEntries] = await Promise.all([
    prisma.checkin.groupBy({ by: ["eventId"], where: { eventId: { in: eventIds } }, _count: { eventId: true } }),
    // Venda primária: Purchase sem listingId. Revenda: Purchase com listingId.
    // Prisma não agrupa "is null" como bucket via groupBy num só round-trip,
    // então são duas queries filtradas em vez de uma.
    prisma.purchase.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds }, status: "COMPLETED", listingId: null },
      _sum: { amountBrl: true },
    }),
    prisma.purchase.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds }, status: "COMPLETED", listingId: { not: null } },
      _sum: { amountBrl: true },
    }),
    // LedgerEntry não tem eventId — só chega lá via purchase.eventId, e
    // Prisma não faz groupBy através de relação, então soma-se em memória.
    prisma.ledgerEntry.findMany({
      where: { userId: user.id, type: "ROYALTY_PAYOUT", purchase: { eventId: { in: eventIds } } },
      select: { amountBrl: true, purchase: { select: { eventId: true } } },
    }),
  ]);

  const checkinByEvent = new Map(checkinCounts.map((c) => [c.eventId, c._count.eventId]));
  const primaryByEvent = new Map(primarySales.map((p) => [p.eventId, Number(p._sum.amountBrl ?? 0)]));
  const resaleByEvent  = new Map(resaleSales.map((p) => [p.eventId, Number(p._sum.amountBrl ?? 0)]));
  const royaltyByEvent = new Map<string, number>();
  for (const e of royaltyEntries) {
    const eventId = e.purchase?.eventId;
    if (!eventId) continue;
    royaltyByEvent.set(eventId, (royaltyByEvent.get(eventId) ?? 0) + Number(e.amountBrl));
  }

  const withMetrics = events.map((e) => ({
    ...e,
    checkins: checkinByEvent.get(e.id) ?? 0,
    primaryRevenueBrl: primaryByEvent.get(e.id) ?? 0,
    resaleVolumeBrl: resaleByEvent.get(e.id) ?? 0,
    royaltiesBrl: royaltyByEvent.get(e.id) ?? 0,
  }));

  return NextResponse.json({ events: withMetrics });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();
  if (organizer.status !== "APPROVED") {
    return NextResponse.json({ error: "Organizer not approved yet" }, { status: 403 });
  }
  // KYB — LAYOUT_UPDATE.md §5.6.1: exigido antes do 1o evento, não antes.
  if (!organizer.kybVerifiedAt) {
    return NextResponse.json({ error: "KYB verification required before publishing an event" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    title, description, venue, city,
    coverImageUrl, coverVideoUrl, eventDate,
    ticketPriceUsdc, maxTickets,
    royaltyBps, royaltyOrgShareBps,
    category, subcategory, lineup, doorsOpenAt,
    maxResaleBps,
  } = body;

  if (!title || !venue || !city || !eventDate || ticketPriceUsdc === undefined) {
    return NextResponse.json(
      { error: "title, venue, city, eventDate and ticketPriceUsdc are required" },
      { status: 400 }
    );
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const price = Number(ticketPriceUsdc);
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "ticketPriceUsdc must be a positive number" }, { status: 400 });
  }

  const date = new Date(eventDate);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "eventDate is invalid" }, { status: 400 });
  }
  if (date.getTime() <= Date.now()) {
    return NextResponse.json({ error: "eventDate must be in the future" }, { status: 400 });
  }

  let max: number | null = null;
  if (maxTickets !== undefined && maxTickets !== null) {
    max = Number(maxTickets);
    if (!Number.isInteger(max) || max < 1) {
      return NextResponse.json({ error: "maxTickets must be a positive integer" }, { status: 400 });
    }
  }

  // Fees/royalties are NOT taken from organizer input.
  // platformFee is fixed by the platform; royalties are clamped to on-chain limits
  // (royaltyBps ≤ 1000 = 10% cap in TicketSale; org share ≤ 10000 = 100%).
  const clamp = (v: unknown, def: number, lo: number, hi: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.min(hi, Math.max(lo, Math.round(n)));
  };
  const platformFeeBps     = Number(process.env.PLATFORM_FEE_BPS ?? 800);
  const finalRoyaltyBps    = royaltyBps === undefined ? 1000 : clamp(royaltyBps, 1000, 0, 1000);
  const finalOrgShareBps   = royaltyOrgShareBps === undefined ? 8000 : clamp(royaltyOrgShareBps, 8000, 0, 10000);

  // Dados de evento — LAYOUT_UPDATE.md §3.1
  const VALID_CATEGORIES = ["SHOW", "FESTIVAL", "TEATRO", "ESPORTE", "CONFERENCIA", "OUTRO"];
  const finalCategory = VALID_CATEGORIES.includes(category) ? category : "OUTRO";

  let doorsOpen: Date | null = null;
  if (doorsOpenAt) {
    doorsOpen = new Date(doorsOpenAt);
    if (Number.isNaN(doorsOpen.getTime())) {
      return NextResponse.json({ error: "doorsOpenAt is invalid" }, { status: 400 });
    }
  }

  // Teto de revenda — LAYOUT_UPDATE.md §5.5. null = mercado livre. Nunca abaixo
  // de 100% (10000 bps): o teto protege comprador de sobrepreço, não existe
  // para forçar revenda com prejuízo.
  let finalMaxResaleBps: number | null = null;
  if (maxResaleBps !== undefined && maxResaleBps !== null && maxResaleBps !== "") {
    const bps = Number(maxResaleBps);
    if (!Number.isInteger(bps) || bps < 10000) {
      return NextResponse.json({ error: "maxResaleBps must be an integer ≥ 10000 (100%), or omitted for no cap" }, { status: 400 });
    }
    finalMaxResaleBps = bps;
  }

  const geo = await geocodeAddress(venue, city);

  const event = await prisma.event.create({
    data: {
      organizerId:        organizer.id,
      title,
      description,
      venue,
      city,
      latitude:            geo?.latitude ?? null,
      longitude:           geo?.longitude ?? null,
      coverImageUrl:      coverImageUrl || null,
      coverVideoUrl:      coverVideoUrl || null,
      eventDate:          date,
      ticketPriceUsdc:    price,
      maxTickets:         max,
      platformFeeBps,
      royaltyBps:         finalRoyaltyBps,
      royaltyOrgShareBps: finalOrgShareBps,
      status:             "PENDING_APPROVAL",
      category:           finalCategory,
      subcategory:        subcategory || null,
      lineup:             lineup || null,
      doorsOpenAt:         doorsOpen,
      maxResaleBps:        finalMaxResaleBps,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
