import { prisma } from "@/lib/db";

// Matriz de ingressos (dias × área × lote) — 2026-08-08, estendida para
// passes multi-dia. O comprador escolhe a COMBINAÇÃO de dias e a área (quando
// existem); o LOTE nunca é escolha dele — troca sozinho conforme cota/data,
// igual promoção de passagem aérea. Este módulo é a única fonte de verdade de
// "qual TicketType está ativo agora" — checkout e exibição (preço "a partir
// de") não podem calcular isso cada um a seu jeito, senão divergem exatamente
// como capacidade divergia antes de lib/availability.ts.

export interface TicketDim {
  id: string;
  name: string;
  date?: string | null;
}

export interface TicketTypeRow {
  id: string;
  dayIds: string[];
  areaId: string | null;
  lotNumber: number;
  quantity: number | null;
  salesEndAt: Date | null;
  onchainTypeId?: number | null;
  earlyEntryMinutes?: number | null;
  label?: string;
  priceUsdc?: unknown; // Decimal do Prisma — repassado como veio, nunca recalculado aqui
}

// Chave canônica de um conjunto de dias: ordenada, pra [d2,d1] e [d1,d2]
// serem o MESMO grupo. Sem isso, dois lotes do mesmo passe cairiam em grupos
// diferentes só por terem sido gravados em ordem distinta, e o comprador
// veria a mesma opção duas vezes.
export function daySetKey(dayIds: string[]): string {
  return [...dayIds].sort().join("|");
}

export function groupKey(dayIds: string[], areaId: string | null): string {
  return `${daySetKey(dayIds)}::${areaId ?? ""}`;
}

export interface TicketGroup {
  dayIds: string[];
  areaId: string | null;
}

// Uma linha por combinação (conjunto de dias, área) presente nos tipos do
// evento — é o que a página do evento oferece como opção de compra. Não
// deriva de Event.ticketDays/ticketAreas diretamente: só interessam
// combinações que TÊM pelo menos um TicketType (uma dimensão declarada sem
// tipo nenhum nela seria uma opção de compra que sempre daria "esgotado").
export function listGroups(types: TicketTypeRow[]): TicketGroup[] {
  const seen = new Map<string, TicketGroup>();
  for (const t of types) {
    const key = groupKey(t.dayIds, t.areaId);
    if (!seen.has(key)) seen.set(key, { dayIds: [...t.dayIds].sort(), areaId: t.areaId });
  }
  return [...seen.values()];
}

// Lote ativo dentro de um grupo: o de menor lotNumber que ainda não passou
// de salesEndAt e ainda tem cota (sold+inFlight < quantity; quantity null =
// sem cota própria, sempre elegível por esse critério). Grupo sem nenhum
// lote elegível = esgotado, não "compra o último mesmo assim".
export async function resolveActiveTicketType(
  eventId: string,
  dayIds: string[],
  areaId: string | null,
  types: TicketTypeRow[]
): Promise<TicketTypeRow | null> {
  const wanted = groupKey(dayIds, areaId);
  const candidates = types
    .filter((t) => groupKey(t.dayIds, t.areaId) === wanted)
    .sort((a, b) => a.lotNumber - b.lotNumber);
  if (candidates.length === 0) return null;

  const now = new Date();
  const withQuota = candidates.filter((t) => t.quantity !== null);
  const usageByType = new Map<string, number>();
  if (withQuota.length > 0) {
    const ids = withQuota.map((t) => t.id);
    const [soldRows, inFlightRows] = await Promise.all([
      prisma.ticket.groupBy({ by: ["ticketTypeId"], where: { eventId, ticketTypeId: { in: ids } }, _count: { _all: true } }),
      prisma.purchase.groupBy({
        by: ["ticketTypeId"],
        where: { eventId, ticketTypeId: { in: ids }, listingId: null, status: { in: ["PENDING", "PAID", "MINTING"] } },
        _count: { _all: true },
      }),
    ]);
    for (const r of soldRows) usageByType.set(r.ticketTypeId!, (usageByType.get(r.ticketTypeId!) ?? 0) + r._count._all);
    for (const r of inFlightRows) usageByType.set(r.ticketTypeId!, (usageByType.get(r.ticketTypeId!) ?? 0) + r._count._all);
  }

  for (const t of candidates) {
    if (t.salesEndAt && t.salesEndAt <= now) continue;
    if (t.quantity !== null && (usageByType.get(t.id) ?? 0) >= t.quantity) continue;
    return t;
  }
  return null;
}

// Um passe é o que cobre mais de um dia. Evento sem dimensão de dia tem
// dayIds vazio em todo tipo e portanto nenhum passe — não é "passe de zero
// dias", é evento de data única.
export function isPass(dayIds: string[]): boolean {
  return dayIds.length > 1;
}

// Nome de exibição de um grupo: nome do dia quando é ingresso de um dia só,
// e o rótulo do próprio tipo quando é passe (o organizador escreveu "Passe
// 3 dias"/"Ultra"; listar "Dia 1, Dia 2, Dia 3" no lugar seria pior).
export function groupDayNames(dayIds: string[], days: TicketDim[]): string[] {
  return dayIds
    .map((id) => days.find((d) => d.id === id)?.name)
    .filter((n): n is string => !!n);
}
