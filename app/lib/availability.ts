import { prisma } from "@/lib/db";

// PLANO_EVOLUCAO_V2.md §9.6/D42 — razão de lotação do evento, fonte única.
// Antes desta fatia, exibição (home/card/mapa) e checkout calculavam
// disponibilidade com fórmulas DIFERENTES: a exibição ignorava `inFlight`
// (compras em andamento), então um evento com muitas compras PIX pendentes
// anunciava vaga que o checkout já recusava. `CapacityUsage` existe pra
// tornar esse esquecimento impossível — quem quiser saber quantas vagas
// existem chama `loadCapacityUsage`, não monta a conta à mão.
export interface CapacityUsage {
  sold: number; // Ticket emitido
  inFlight: number; // Purchase PENDING | PAID | MINTING (venda direta, não revenda)
  codesPending: number; // AccessCode não usado e não revogado — PLANO_DEV_ONDA6.md Fase 4
  unusedReserve: number; // reservedTickets − reservedTicketsAssigned
}

// Uma query por evento (em paralelo); use loadCapacityUsageMany para lista,
// que faz uma query POR PARCELA em vez de uma por evento (evita N+1 na home).
export async function loadCapacityUsage(
  eventId: string,
  event: { reservedTickets: number; reservedTicketsAssigned: number }
): Promise<CapacityUsage> {
  const [sold, inFlight, codesPending] = await Promise.all([
    prisma.ticket.count({ where: { eventId } }),
    prisma.purchase.count({
      where: { eventId, listingId: null, status: { in: ["PENDING", "PAID", "MINTING"] } },
    }),
    prisma.accessCode.count({ where: { eventId, usedAt: null, revokedAt: null } }),
  ]);
  return {
    sold,
    inFlight,
    codesPending,
    unusedReserve: event.reservedTickets - event.reservedTicketsAssigned,
  };
}

// Versão em lote — home/nearby/organizer listam várias dezenas de eventos de
// uma vez; chamar loadCapacityUsage em loop seria N×3 queries. Uma query por
// parcela via groupBy, depois junta em memória por eventId.
export async function loadCapacityUsageMany(
  events: { id: string; reservedTickets: number; reservedTicketsAssigned: number }[]
): Promise<Map<string, CapacityUsage>> {
  const eventIds = events.map((e) => e.id);
  if (eventIds.length === 0) return new Map();

  const [soldRows, inFlightRows, codesRows] = await Promise.all([
    prisma.ticket.groupBy({ by: ["eventId"], where: { eventId: { in: eventIds } }, _count: { _all: true } }),
    prisma.purchase.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds }, listingId: null, status: { in: ["PENDING", "PAID", "MINTING"] } },
      _count: { _all: true },
    }),
    prisma.accessCode.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds }, usedAt: null, revokedAt: null },
      _count: { _all: true },
    }),
  ]);

  const soldByEvent = new Map(soldRows.map((r) => [r.eventId, r._count._all]));
  const inFlightByEvent = new Map(inFlightRows.map((r) => [r.eventId, r._count._all]));
  const codesByEvent = new Map(codesRows.map((r) => [r.eventId, r._count._all]));

  const result = new Map<string, CapacityUsage>();
  for (const e of events) {
    result.set(e.id, {
      sold: soldByEvent.get(e.id) ?? 0,
      inFlight: inFlightByEvent.get(e.id) ?? 0,
      codesPending: codesByEvent.get(e.id) ?? 0,
      unusedReserve: e.reservedTickets - e.reservedTicketsAssigned,
    });
  }
  return result;
}

// Disponibilidade PÚBLICA — desconta a reserva do organizador ainda não
// usada. É o número mostrado na home/card/checkout de compra normal.
// maxTickets null = evento sem teto; nada a descontar de oferta ilimitada.
export function publicAvailability(
  event: { maxTickets: number | null },
  usage: CapacityUsage
): number | null {
  if (event.maxTickets === null) return null;
  return event.maxTickets - usage.sold - usage.inFlight - usage.codesPending - usage.unusedReserve;
}

// Disponibilidade contra o TETO REAL do evento, sem descontar a reserva —
// é o que a alocação reservada (organizador nomeando beneficiário) precisa
// checar: ela consome do teto real, não do que sobrou depois da reserva
// (senão a própria reserva se descontaria dela mesma).
export function hardCapAvailability(
  event: { maxTickets: number | null },
  usage: CapacityUsage
): number | null {
  if (event.maxTickets === null) return null;
  return event.maxTickets - usage.sold - usage.inFlight - usage.codesPending;
}
