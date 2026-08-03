import { prisma } from "@/lib/db";
import { usdcToBrl } from "@/lib/fx";
import { distanceKm } from "@/lib/geo";
import { PageTitle } from "./components/ui/PageTitle";
import { EventCard } from "./components/ui/EventCard";
import { EmptyState } from "./components/ui/EmptyState";
import { Button } from "./components/ui/Button";
import { Carousel, type CarouselSlide } from "./components/ui/Carousel";
import { EventFilters } from "./components/ui/EventFilters";
import { MapTriggerButton } from "./components/ui/MapTriggerButton";
import type { IconName } from "./components/ui/Icon";

export const dynamic = "force-dynamic";

// App é Brasil-only (preços em BRL, cidades brasileiras) — filtro de data usa
// o dia civil em America/Sao_Paulo (UTC-3, sem horário de verão desde 2019),
// não UTC, senão um show às 21h cai no filtro do dia seguinte.
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;
function localDayRangeUtc(dateStr: string): { gte: Date; lt: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + BR_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { gte: startUtc, lt: endUtc };
}

const CATEGORY_ICON: Record<string, IconName> = {
  SHOW: "portal",
  FESTIVAL: "quadrifolio",
  TEATRO: "ticket",
  ESPORTE: "coluna",
  CONFERENCIA: "cartao",
  OUTRO: "portal",
};

const CATEGORY_LABEL: Record<string, string> = {
  SHOW: "Show",
  FESTIVAL: "Festival",
  TEATRO: "Teatro",
  ESPORTE: "Esporte",
  CONFERENCIA: "Conferência",
  OUTRO: "Evento",
};

const GRADIENTS = ["var(--grad-energia)", "var(--grad-profundidade)", "var(--grad-legado)"];

async function getFeaturedSlides(): Promise<CarouselSlide[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1) Pin do admin — LAYOUT_UPDATE.md §4.1, passo 1
  const pinned = await prisma.event.findMany({
    where: { status: { in: ["ON_SALE", "PAUSED"] }, featuredRank: { not: null } },
    include: { organizer: { select: { companyName: true } }, _count: { select: { tickets: true } } },
    orderBy: { featuredRank: "asc" },
    take: 5,
  });

  const slots = 5 - pinned.length;
  let ranked: typeof pinned = [];
  if (slots > 0) {
    // 2) Vendas recentes — Purchase COMPLETED nos últimos 7 dias, agrupado por evento
    const recentSales = await prisma.purchase.groupBy({
      by: ["eventId"],
      where: { status: "COMPLETED", completedAt: { gte: sevenDaysAgo }, eventId: { notIn: pinned.map((p) => p.id) } },
      _count: { eventId: true },
      orderBy: { _count: { eventId: "desc" } },
      take: slots,
    });

    if (recentSales.length > 0) {
      const bySales = await prisma.event.findMany({
        where: { id: { in: recentSales.map((r) => r.eventId) }, status: { in: ["ON_SALE", "PAUSED"] } },
        include: { organizer: { select: { companyName: true } }, _count: { select: { tickets: true } } },
      });
      // preserva a ordem de vendas
      const order = new Map(recentSales.map((r, i) => [r.eventId, i]));
      ranked = bySales.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }

    // 3) Fallback — sem isso, base vazia = carrossel some (§4.1)
    const stillNeeded = slots - ranked.length;
    if (stillNeeded > 0) {
      const exclude = [...pinned, ...ranked].map((e) => e.id);
      const fallback = await prisma.event.findMany({
        where: { status: { in: ["ON_SALE", "PAUSED"] }, id: { notIn: exclude }, eventDate: { gte: now } },
        include: { organizer: { select: { companyName: true } }, _count: { select: { tickets: true } } },
        orderBy: { eventDate: "asc" },
        take: stillNeeded,
      });
      ranked = [...ranked, ...fallback];
    }
  }

  const combined = [...pinned, ...ranked];
  return Promise.all(
    combined.map(async (e, i) => {
      const priceBrl = await usdcToBrl(Number(e.ticketPriceUsdc));
      const soldOut = e.maxTickets !== null && e._count.tickets >= e.maxTickets;
      return {
        href: `/events/${e.id}`,
        grad: GRADIENTS[i % GRADIENTS.length],
        coverImageUrl: e.coverImageUrl,
        coverVideoUrl: e.coverVideoUrl,
        rank: i + 1,
        icon: CATEGORY_ICON[e.category] ?? "portal",
        tag: e.subcategory ? `${CATEGORY_LABEL[e.category]} · ${e.subcategory}` : CATEGORY_LABEL[e.category],
        title: e.title,
        meta: [
          `${new Date(e.eventDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} · ${e.venue} — ${e.city}`,
          e.lineup ?? e.organizer.companyName,
        ],
        ctaLabel: soldOut ? "Ver no mercado" : "Comprar ingresso",
        priceLabel: "A partir de",
        price: `R$ ${priceBrl.toFixed(2).replace(".", ",")}`,
      };
    })
  );
}

// Prisma não tem um "sort" único que cubra alfabética e preço ao mesmo tempo
// que a distância (calculada em memória) — por isso o orderBy do banco é só
// o ponto de partida; a reordenação por distância e o rebaixamento de
// esgotados acontecem depois, em memória (PLANO_EVOLUCAO_V2.md §3.1/§3.5).
const SORT_ORDER_BY = {
  date:       { eventDate: "asc" as const },
  az:         { title: "asc" as const },
  za:         { title: "desc" as const },
  price_asc:  { ticketPriceUsdc: "asc" as const },
  price_desc: { ticketPriceUsdc: "desc" as const },
};
type SortKey = keyof typeof SORT_ORDER_BY;

function isSoldOut(e: { maxTickets: number | null; sold: number }): boolean {
  return e.maxTickets !== null && e.sold >= e.maxTickets;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string; q?: string; cat?: string; from?: string; to?: string;
    sort?: string; near?: string; showAll?: string;
  }>;
}) {
  const sp      = await searchParams;
  const city    = sp.city;
  const q       = sp.q;
  const cat     = sp.cat;
  const from    = sp.from;
  const to      = sp.to;
  const showAll = sp.showAll === "1";
  const sort: SortKey = sp.sort && sp.sort in SORT_ORDER_BY ? (sp.sort as SortKey) : "date";

  let nearPoint: { lat: number; lng: number } | null = null;
  if (sp.near) {
    const [latStr, lngStr] = sp.near.split(",");
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (Number.isFinite(lat) && Number.isFinite(lng)) nearPoint = { lat, lng };
  }

  // D8 — a home é "Próximos eventos", então o piso é sempre hoje; `from`
  // explícito do usuário substitui esse piso, nunca soma a ele.
  const now = new Date();
  const dateFilter: { gte?: Date; lt?: Date } = { gte: now };
  if (from) dateFilter.gte = localDayRangeUtc(from).gte;
  if (to) dateFilter.lt = localDayRangeUtc(to).lt;

  const [events, cities, slides] = await Promise.all([
    prisma.event.findMany({
      where: {
        status: { in: showAll ? ["ON_SALE", "PAUSED"] : ["ON_SALE"] },
        ...(city ? { city } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(cat ? { category: cat as never } : {}),
        eventDate: dateFilter,
      },
      include: {
        organizer: { select: { companyName: true } },
        _count:    { select: { tickets: true } },
      },
      orderBy: SORT_ORDER_BY[sort],
    }),
    prisma.event.findMany({
      where: { status: { in: ["ON_SALE", "PAUSED"] } },
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    }),
    getFeaturedSlides(),
  ]);

  const cards = await Promise.all(
    events.map(async (e) => ({
      ...e,
      priceBrl: await usdcToBrl(Number(e.ticketPriceUsdc)),
      sold:     e._count.tickets,
    }))
  );

  // "Perto de você" reordena tudo por distância — sobrepõe o sort escolhido
  // e desliga o rebaixamento de esgotados, que só faz sentido numa ordem
  // cronológica. Sem lat/lng, o card vai pro fim (Array.sort é estável).
  if (nearPoint) {
    cards.sort((a, b) => {
      const da = a.latitude != null && a.longitude != null
        ? distanceKm(nearPoint.lat, nearPoint.lng, a.latitude, a.longitude) : Infinity;
      const db = b.latitude != null && b.longitude != null
        ? distanceKm(nearPoint.lat, nearPoint.lng, b.latitude, b.longitude) : Infinity;
      return da - db;
    });
  }

  // D10 — esgotado nunca é escondido (alimenta a Revenda), só rebaixado, e só
  // na ordem cronológica default: numa ordenação explícita (alfabética,
  // preço) ou por distância, reordenar por cima quebraria o que foi pedido.
  const demoteSoldOut = sort === "date" && !nearPoint;
  const orderedCards = demoteSoldOut
    ? [...cards.filter((e) => !isSoldOut(e)), ...cards.filter((e) => isSoldOut(e))]
    : cards;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {slides.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 font-display text-2xl text-text">
            <em className="text-laranja-400 not-italic">Destaques</em> da semana
          </h2>
          <Carousel slides={slides} />
        </div>
      )}

      <PageTitle subtitle="Encontre sua próxima experiência memorável.">
        Próximos eventos
      </PageTitle>

      <form method="GET" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar evento…"
          className="h-11 flex-1 rounded-md border border-border bg-surface-2 px-4 text-[15px] text-text placeholder:text-text-muted focus:border-ouro-400 focus:outline-none"
        />
        <Button type="submit">Buscar</Button>
        <MapTriggerButton />
      </form>

      <EventFilters cities={cities.map((c) => c.city)} />

      {orderedCards.length === 0 ? (
        <EmptyState icon="quadrifolio" title="Nenhum evento encontrado." description="Ajuste a busca ou volte mais tarde." />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {orderedCards.map((e, i) => {
            const soldOut = isSoldOut(e);
            const date = new Date(e.eventDate);
            const availablePct =
              e.maxTickets ? Math.max(0, 100 - (e.sold / e.maxTickets) * 100) : undefined;
            return (
              <EventCard
                key={e.id}
                href={`/events/${e.id}`}
                coverImageUrl={e.coverImageUrl}
                fallbackIcon={CATEGORY_ICON[e.category] ?? "portal"}
                gradIndex={i}
                day={date.toLocaleDateString("pt-BR", { day: "2-digit" })}
                month={date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                badge={
                  soldOut
                    ? { label: "Esgotado", variant: "error" }
                    : e.status === "PAUSED"
                    ? { label: "Pausado", variant: "warning" }
                    : { label: "Vendas abertas", variant: "success" }
                }
                category={e.subcategory ? `${CATEGORY_LABEL[e.category]} · ${e.subcategory}` : CATEGORY_LABEL[e.category]}
                title={e.title}
                meta={`${e.venue} · ${e.city}`}
                availablePct={availablePct}
                availableLabel={
                  e.maxTickets ? `${e.maxTickets - e.sold} de ${e.maxTickets} disponíveis` : `${e.sold} vendidos`
                }
                priceLabel="A partir de"
                price={`R$ ${e.priceBrl.toFixed(2).replace(".", ",")}`}
                cta={soldOut ? "Ver mercado" : "Comprar"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
