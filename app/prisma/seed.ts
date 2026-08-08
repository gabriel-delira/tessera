import {
  PrismaClient,
  UserRole,
  OrganizerStatus,
  EventStatus,
  EventCategory,
  KycLevel,
  TicketStatus,
  ListingStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { join } from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Ancorado numa data fixa (não Date.now()) para que "passado"/"futuro" não
// mude sozinho conforme o tempo passa e o seed vira estável para snapshots.
const TODAY = new Date("2026-07-31T00:00:00Z");
const daysFrom = (n: number) => new Date(TODAY.getTime() + n * 86_400_000);

async function main() {
  // Load contract addresses written by Deploy.s.sol
  let addresses = { nft: "", sale: "", resale: "" };
  try {
    const raw = readFileSync(
      join(__dirname, "../lib/contracts/addresses.local.json"),
      "utf-8",
    );
    addresses = JSON.parse(raw);
  } catch {
    console.warn("addresses.local.json not found — run `forge script` first");
  }

  // ── Usuários base ──────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { privyId: "local-admin" },
    create: {
      privyId: "local-admin",
      email: "admin@tessera.local",
      walletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      role: UserRole.ADMIN,
    },
    update: {},
  });

  const orgUser = await prisma.user.upsert({
    where: { privyId: "local-organizer" },
    create: {
      privyId: "local-organizer",
      email: "org@tessera.local",
      walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      role: UserRole.ORGANIZER,
    },
    update: {},
  });

  const organizer = await prisma.organizer.upsert({
    where: { userId: orgUser.id },
    create: {
      userId: orgUser.id,
      companyName: "Produtora Exemplo Ltda",
      document: "00.000.000/0001-00",
      payoutWallet: orgUser.walletAddress!,
      status: OrganizerStatus.APPROVED,
      kybVerifiedAt: daysFrom(-200),
    },
    update: {},
  });

  // Comprador de demonstração: já com CPF + KYC completo, dono de ingressos
  // passados com check-in — alimenta Minha Coleção (álbum + conquistas, §8).
  const buyer = await prisma.user.upsert({
    where: { privyId: "local-buyer" },
    create: {
      privyId: "local-buyer",
      email: "buyer@tessera.local",
      walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      role: UserRole.BUYER,
      cpf: "11111111111",
      displayName: "Comprador Demo",
      kycLevel: KycLevel.VERIFIED,
      kycVerifiedAt: daysFrom(-150),
      payoutMethod: "PIX",
      pixKey: "buyer@tessera.local",
      pixKeyUpdatedAt: daysFrom(-150),
    },
    update: {},
  });

  // Comprador recém-chegado: sem ingressos, sem CPF, sem KYC. Existe para
  // exercitar os estados vazios (álbum sem nada, gates de KYC) que o `buyer`
  // acima já não consegue mostrar por ter histórico completo.
  await prisma.user.upsert({
    where: { privyId: "local-buyer-empty" },
    create: {
      privyId: "local-buyer-empty",
      email: "novato@tessera.local",
      walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      role: UserRole.BUYER,
      displayName: "Comprador Novato",
    },
    update: {},
  });

  const staff = await prisma.user.upsert({
    where: { privyId: "local-staff" },
    create: {
      privyId: "local-staff",
      email: "staff@tessera.local",
      walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      role: UserRole.STAFF,
    },
    update: {},
  });

  // ── Eventos ────────────────────────────────────────────────────────────────
  // Cobrem os estados que a UI precisa exercitar (§3.2): cidades e categorias
  // variadas, com/sem capa, esgotado, pausado, aguardando aprovação, destaque
  // fixado pelo admin, teto de revenda configurado/livre, e ≥3 eventos passados
  // com check-in para colecionáveis + conquistas.
  type SeedEvent = {
    id: string;
    title: string;
    description: string;
    venue: string;
    city: string;
    latitude: number;
    longitude: number;
    category: EventCategory;
    subcategory: string;
    lineup?: string;
    coverImageUrl?: string;
    eventDate: Date;
    doorsOpenAt?: Date;
    ticketPriceUsdc: number;
    maxTickets: number | null;
    status: EventStatus;
    featuredRank?: number;
    maxResaleBps?: number | null;
  };

  const events: SeedEvent[] = [
    {
      id: "seed-event-1",
      title: "Show da Banda Aurora",
      description: "Turnê \"Horizonte\" — Banda Aurora ao vivo no Allianz Parque.",
      venue: "Allianz Parque",
      city: "São Paulo",
      latitude: -23.5273,
      longitude: -46.6803,
      category: EventCategory.SHOW,
      subcategory: "Rock",
      lineup: "Banda Aurora",
      coverImageUrl: "https://picsum.photos/seed/aurora/800/450",
      eventDate: daysFrom(12),
      doorsOpenAt: new Date(daysFrom(12).getTime() - 2 * 3_600_000),
      ticketPriceUsdc: 45.0,
      maxTickets: 500,
      status: EventStatus.ON_SALE,
      featuredRank: 1,
      maxResaleBps: 20000, // 200%
    },
    {
      id: "seed-event-2",
      title: "Festival Maré Alta",
      description: "Dois palcos, música eletrônica e MPB na Marina da Glória.",
      venue: "Marina da Glória",
      city: "Rio de Janeiro",
      latitude: -22.9192,
      longitude: -43.1729,
      category: EventCategory.FESTIVAL,
      subcategory: "Eletrônica",
      lineup: "Vários artistas",
      eventDate: daysFrom(51),
      ticketPriceUsdc: 180.0,
      maxTickets: 2000,
      status: EventStatus.ON_SALE,
      maxResaleBps: 15000, // 150%
    },
    {
      id: "seed-event-3",
      title: "Otelo",
      description: "Clássico de Shakespeare em nova montagem.",
      venue: "Teatro Municipal",
      city: "São Paulo",
      latitude: -23.5450,
      longitude: -46.6382,
      category: EventCategory.TEATRO,
      subcategory: "Drama",
      coverImageUrl: "https://picsum.photos/seed/otelo/800/450",
      eventDate: daysFrom(20),
      ticketPriceUsdc: 60.0,
      maxTickets: 300,
      status: EventStatus.PAUSED,
      maxResaleBps: 10000, // 100% — nunca acima do preço de venda
    },
    {
      id: "seed-event-4",
      title: "Final do Campeonato Estadual",
      description: "Grande final, ingressos limitados.",
      venue: "Mineirão",
      city: "Belo Horizonte",
      latitude: -19.8659,
      longitude: -43.9714,
      category: EventCategory.ESPORTE,
      subcategory: "Futebol",
      eventDate: daysFrom(8),
      ticketPriceUsdc: 90.0,
      maxTickets: 3,
      status: EventStatus.ON_SALE, // esgotado via contagem de tickets abaixo
      maxResaleBps: null,
    },
    {
      id: "seed-event-5",
      title: "Conferência TechBR",
      description: "Dois dias de palestras sobre engenharia e produto.",
      venue: "Centro de Convenções",
      city: "São Paulo",
      latitude: -23.5320,
      longitude: -46.6396,
      category: EventCategory.CONFERENCIA,
      subcategory: "Tecnologia",
      eventDate: daysFrom(70),
      ticketPriceUsdc: 250.0,
      maxTickets: 800,
      status: EventStatus.PENDING_APPROVAL,
      maxResaleBps: 10000,
    },
    {
      id: "seed-event-6",
      title: "Show Retrô — Anos 80",
      description: "Uma noite dedicada aos clássicos dos anos 80.",
      venue: "Ópera de Arame",
      city: "Curitiba",
      latitude: -25.3960,
      longitude: -49.2854,
      category: EventCategory.SHOW,
      subcategory: "Pop",
      coverImageUrl: "https://picsum.photos/seed/retro80/800/450",
      eventDate: new Date("2026-03-15T22:00:00Z"), // passado
      ticketPriceUsdc: 70.0,
      maxTickets: 400,
      status: EventStatus.ON_SALE,
      maxResaleBps: 20000,
    },
    {
      id: "seed-event-7",
      title: "Festival de Inverno",
      description: "Festival de música regional.",
      venue: "Parque da Redenção",
      city: "Porto Alegre",
      latitude: -30.0361,
      longitude: -51.2114,
      category: EventCategory.FESTIVAL,
      subcategory: "MPB",
      eventDate: new Date("2026-06-20T19:00:00Z"), // passado
      ticketPriceUsdc: 55.0,
      maxTickets: 1000,
      status: EventStatus.ON_SALE,
      maxResaleBps: 15000,
    },
    {
      id: "seed-event-8",
      title: "Stand-up do Fábio",
      description: "Show de comédia stand-up.",
      venue: "Teatro Rival",
      city: "Rio de Janeiro",
      latitude: -22.9092,
      longitude: -43.1765,
      category: EventCategory.TEATRO,
      subcategory: "Stand-up",
      eventDate: new Date("2026-05-10T21:00:00Z"), // passado
      ticketPriceUsdc: 40.0,
      maxTickets: 200,
      status: EventStatus.ON_SALE,
      maxResaleBps: 10000,
    },
    {
      id: "seed-event-9",
      title: "Corrida de Rua 10K",
      description: "Prova de rua pelo centro histórico.",
      venue: "Largo do Arouche",
      city: "São Paulo",
      latitude: -23.5389,
      longitude: -46.6428,
      category: EventCategory.ESPORTE,
      subcategory: "Corrida",
      eventDate: new Date("2026-02-08T07:00:00Z"), // passado
      ticketPriceUsdc: 30.0,
      maxTickets: 5000,
      status: EventStatus.ON_SALE,
      maxResaleBps: null,
    },
    {
      id: "seed-event-10",
      title: "DJ Set Sunset",
      description: "Pôr do sol com line-up eletrônico na praia.",
      venue: "Beach Park",
      city: "Fortaleza",
      latitude: -3.8926,
      longitude: -38.3903,
      category: EventCategory.FESTIVAL,
      subcategory: "Eletrônica",
      eventDate: daysFrom(35),
      ticketPriceUsdc: 120.0,
      maxTickets: 600,
      status: EventStatus.ON_SALE,
      maxResaleBps: 15000,
    },
    {
      id: "seed-event-11",
      title: "Peça Infantil — O Sítio Encantado",
      description: "Espetáculo para toda a família.",
      venue: "Teatro Guararapes",
      city: "Recife",
      latitude: -8.0578,
      longitude: -34.8829,
      category: EventCategory.TEATRO,
      subcategory: "Infantil",
      eventDate: daysFrom(28),
      ticketPriceUsdc: 35.0,
      maxTickets: 350,
      status: EventStatus.ON_SALE,
      maxResaleBps: 10000,
    },
    {
      id: "seed-event-12",
      title: "Hackathon Tessera",
      description: "48h de maratona de programação com premiação.",
      venue: "Campus Tech",
      city: "São Paulo",
      latitude: -23.5613,
      longitude: -46.6565,
      category: EventCategory.CONFERENCIA,
      subcategory: "Tecnologia",
      eventDate: daysFrom(90),
      ticketPriceUsdc: 20.0,
      maxTickets: null,
      status: EventStatus.ON_SALE,
      maxResaleBps: null, // mercado livre
    },
  ];

  const createdEvents: Record<string, { id: string }> = {};
  for (const e of events) {
    const data = {
      organizerId: organizer.id,
      title: e.title,
      description: e.description,
      venue: e.venue,
      city: e.city,
      latitude: e.latitude,
      longitude: e.longitude,
      category: e.category,
      subcategory: e.subcategory,
      lineup: e.lineup,
      coverImageUrl: e.coverImageUrl,
      eventDate: e.eventDate,
      doorsOpenAt: e.doorsOpenAt,
      ticketPriceUsdc: e.ticketPriceUsdc,
      maxTickets: e.maxTickets,
      platformFeeBps: 800,
      royaltyBps: 1000,
      royaltyOrgShareBps: 8000,
      status: e.status,
      featuredRank: e.featuredRank ?? null,
      maxResaleBps: e.maxResaleBps ?? null,
    };
    const created = await prisma.event.upsert({
      where: { id: e.id },
      create: { id: e.id, ...data },
      update: data,
    });
    createdEvents[e.id] = created;

    // PLANO_EVOLUCAO_V2.md §5.1 — mesmo TicketType único que POST /api/organizer/events
    // cria em produção, espelhando ticketPriceUsdc/maxTickets do fixture.
    await prisma.ticketType.upsert({
      where: { id: `tt_${e.id}` },
      create: {
        id:        `tt_${e.id}`,
        eventId:   e.id,
        label:     "Inteira",
        priceUsdc: e.ticketPriceUsdc,
        quantity:  e.maxTickets,
      },
      update: { priceUsdc: e.ticketPriceUsdc, quantity: e.maxTickets },
    });
  }

  // ── Ingressos + check-ins ────────────────────────────────────────────────
  // seed-event-4: esgota o evento (maxTickets = 3) com donos genéricos.
  for (let i = 0; i < 3; i++) {
    await prisma.ticket.upsert({
      where: { tokenId: 9000 + i },
      create: {
        tokenId: 9000 + i,
        eventId: "seed-event-4",
        ownerAddress: "0x000000000000000000000000000000000000fA",
        ticketNumber: i + 1,
        facePrice: 90.0,
        status: TicketStatus.VALID,
        mintedAt: daysFrom(-5),
      },
      update: {},
    });
  }

  // Ingressos passados do buyer — base para "Você esteve lá", álbum e conquistas.
  // 6, 8 e 9 têm check-in em meses distintos de 2026 (ano completo); 7 é válido
  // sem check-in (colecionável sem selo de presença).
  const buyerTickets = [
    { tokenId: 9101, eventId: "seed-event-6", ticketNumber: 1, price: 70.0, checkedInAt: new Date("2026-03-15T22:10:00Z") },
    { tokenId: 9102, eventId: "seed-event-7", ticketNumber: 1, price: 55.0, checkedInAt: null },
    { tokenId: 9103, eventId: "seed-event-8", ticketNumber: 1, price: 40.0, checkedInAt: new Date("2026-05-10T21:05:00Z") },
    { tokenId: 9104, eventId: "seed-event-9", ticketNumber: 1, price: 30.0, checkedInAt: new Date("2026-02-08T07:03:00Z") },
  ];

  for (const t of buyerTickets) {
    await prisma.ticket.upsert({
      where: { tokenId: t.tokenId },
      create: {
        tokenId: t.tokenId,
        eventId: t.eventId,
        ownerAddress: buyer.walletAddress!,
        ticketNumber: t.ticketNumber,
        facePrice: t.price,
        status: t.checkedInAt ? TicketStatus.CHECKED_IN : TicketStatus.VALID,
        mintedAt: daysFrom(-160),
      },
      update: {},
    });

    if (t.checkedInAt) {
      await prisma.checkin.upsert({
        where: { tokenId: t.tokenId },
        create: {
          tokenId: t.tokenId,
          eventId: t.eventId,
          staffUserId: staff.id,
          scannedAt: t.checkedInAt,
        },
        update: {},
      });
    }
  }

  // Ingresso futuro do buyer — para a seção "próximos" do álbum (§8.1).
  await prisma.ticket.upsert({
    where: { tokenId: 9105 },
    create: {
      tokenId: 9105,
      eventId: "seed-event-1",
      ownerAddress: buyer.walletAddress!,
      ticketNumber: 42,
      facePrice: 45.0,
      status: TicketStatus.VALID,
      mintedAt: daysFrom(-2),
    },
    update: {},
  });

  // ── Anúncios de revenda ───────────────────────────────────────────────────
  // /api/market só devolve Listing ACTIVE com onchainListingId preenchido, então
  // o seed grava um id sintético — serve para exercitar a UI do mercado; o
  // checkout desses anúncios não fecha on-chain porque o listing não existe no
  // TicketResale local. Metade é do `buyer` (exercita a visão de dono:
  // "Seu ingresso" + Detalhes) e metade de outra carteira (exercita comprar e
  // propor). Preços respeitam o maxResaleBps de cada evento.
  const OTHER_SELLER = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"; // anvil #6

  type SeedListing = {
    tokenId: number;
    eventId: string;
    ticketNumber: number;
    facePrice: number;
    price: number;
    seller: string;
    checkedIn?: boolean; // só faz sentido em colecionável — alimenta "Você esteve lá"
  };

  const seedListings: SeedListing[] = [
    // Aba "Ingressos" — eventos futuros
    { tokenId: 9200, eventId: "seed-event-1",  ticketNumber: 101, facePrice: 45.0,  price: 62.0,  seller: buyer.walletAddress! },
    { tokenId: 9201, eventId: "seed-event-2",  ticketNumber: 101, facePrice: 180.0, price: 240.0, seller: buyer.walletAddress! },
    { tokenId: 9202, eventId: "seed-event-10", ticketNumber: 101, facePrice: 120.0, price: 150.0, seller: buyer.walletAddress! },
    { tokenId: 9203, eventId: "seed-event-11", ticketNumber: 101, facePrice: 35.0,  price: 35.0,  seller: buyer.walletAddress! },
    { tokenId: 9204, eventId: "seed-event-1",  ticketNumber: 102, facePrice: 45.0,  price: 80.0,  seller: buyer.walletAddress! },
    { tokenId: 9205, eventId: "seed-event-2",  ticketNumber: 102, facePrice: 180.0, price: 199.0, seller: OTHER_SELLER },
    { tokenId: 9206, eventId: "seed-event-10", ticketNumber: 102, facePrice: 120.0, price: 135.0, seller: OTHER_SELLER },
    { tokenId: 9207, eventId: "seed-event-1",  ticketNumber: 103, facePrice: 45.0,  price: 55.0,  seller: OTHER_SELLER },
    // Aba "Colecionáveis" — eventos passados
    { tokenId: 9210, eventId: "seed-event-6",  ticketNumber: 101, facePrice: 70.0,  price: 90.0,  seller: OTHER_SELLER, checkedIn: true },
    { tokenId: 9211, eventId: "seed-event-8",  ticketNumber: 101, facePrice: 40.0,  price: 48.0,  seller: buyer.walletAddress! },
  ];

  for (const [i, l] of seedListings.entries()) {
    await prisma.ticket.upsert({
      where: { tokenId: l.tokenId },
      create: {
        tokenId: l.tokenId,
        eventId: l.eventId,
        ownerAddress: l.seller,
        ticketNumber: l.ticketNumber,
        facePrice: l.facePrice,
        status: TicketStatus.LISTED,
        mintedAt: daysFrom(-30),
      },
      update: { ownerAddress: l.seller, status: TicketStatus.LISTED },
    });

    if (l.checkedIn) {
      await prisma.checkin.upsert({
        where: { tokenId: l.tokenId },
        create: { tokenId: l.tokenId, eventId: l.eventId, staffUserId: staff.id, scannedAt: daysFrom(-138) },
        update: {},
      });
    }

    const listingId = `seed-listing-${l.tokenId}`;
    const listingData = {
      onchainListingId: 900 + i,
      tokenId: l.tokenId,
      sellerAddress: l.seller,
      price: l.price,
      paymentToken: process.env.USDC_ADDRESS ?? "0x0000000000000000000000000000000000000000",
      expiresAt: daysFrom(30),
      status: ListingStatus.ACTIVE,
    };
    await prisma.listing.upsert({
      where: { id: listingId },
      create: { id: listingId, ...listingData },
      update: listingData,
    });
  }

  // Seed sync_state for deployed contracts
  if (addresses.sale) {
    for (const addr of [addresses.sale, addresses.resale]) {
      if (!addr) continue;
      await prisma.syncState.upsert({
        where: { contractAddress: addr },
        create: { contractAddress: addr, lastProcessedBlock: BigInt(0) },
        update: {},
      });
    }
  }

  console.log("Seed complete.", {
    admin: admin.id,
    organizer: organizer.id,
    buyer: buyer.id,
    events: events.length,
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
