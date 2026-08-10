// Validação/normalização da matriz de ingressos (dia × área × lote) recebida
// do Step 2 do NewEventModal — compartilhada entre POST /api/organizer/events
// e PATCH /api/organizer/events/[id] pra não divergir a regra de validação
// entre criar e editar.
// `date` só existe em `ticketDays` (área não tem data) e é a data de
// CALENDÁRIO daquele dia, "YYYY-MM-DD", sem hora e sem fuso — é o que o
// check-in usa pra saber qual dia do evento é hoje (lib/eventDay.ts).
// Opcional no parser de propósito: eventos multi-dia criados antes desta
// fatia não têm data nenhuma gravada, e recusá-los aqui quebraria a edição
// deles. Quem obriga a data é o Step 2 do NewEventModal, pra todo evento novo.
export interface TicketDim {
  id: string;
  name: string;
  date?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedTicketType {
  dayIds: string[];
  areaId: string | null;
  lotNumber: number;
  label: string;
  priceUsdc: number;
  quantity: number | null;
  salesEndAt: Date | null;
  earlyEntryMinutes: number | null;
}

// Teto do perk de entrada antecipada. 12h é folga larga pra qualquer caso
// real (o recorde é "entra de manhã num evento que abre à noite") e ainda
// assim barra um 99999 digitado errado que faria o ingresso valer desde a
// véspera.
const MAX_EARLY_ENTRY_MINUTES = 12 * 60;

export interface ParsedMatrix {
  ticketDays: TicketDim[] | null;
  ticketAreas: TicketDim[] | null;
  ticketTypes: ParsedTicketType[];
  priceUsdc: number; // denormalização: menor preço entre os tipos elegíveis
  maxTickets: number | null; // soma das cotas, só se TODO tipo tiver cota própria
}

export function parseTicketMatrix(body: {
  ticketDays?: unknown;
  ticketAreas?: unknown;
  ticketTypes?: unknown;
}): { ok: true; matrix: ParsedMatrix } | { ok: false; error: string } {
  const parseDims = (raw: unknown, fieldName: string): TicketDim[] | null => {
    if (raw === undefined || raw === null) return null;
    if (!Array.isArray(raw)) throw new Error(`${fieldName} must be an array or omitted`);
    return raw.map((d, i) => {
      if (!d || typeof d.id !== "string" || !d.id || typeof d.name !== "string" || !d.name.trim()) {
        throw new Error(`${fieldName}[${i}] must have a non-empty id and name`);
      }
      // Data só é lida em ticketDays; se vier em ticketAreas é ignorada.
      if (fieldName !== "ticketDays") return { id: d.id, name: d.name.trim() };
      if (d.date === undefined || d.date === null || d.date === "") {
        return { id: d.id, name: d.name.trim(), date: null };
      }
      if (typeof d.date !== "string" || !ISO_DATE.test(d.date) || Number.isNaN(Date.parse(`${d.date}T00:00:00Z`))) {
        throw new Error(`${fieldName}[${i}].date must be a calendar date in YYYY-MM-DD format`);
      }
      return { id: d.id, name: d.name.trim(), date: d.date };
    });
  };

  let ticketDays: TicketDim[] | null;
  let ticketAreas: TicketDim[] | null;
  try {
    ticketDays  = parseDims(body.ticketDays, "ticketDays");
    ticketAreas = parseDims(body.ticketAreas, "ticketAreas");
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  // Duas datas iguais deixariam "qual dia é hoje" ambíguo na porta
  // (lib/eventDay.ts resolve por data de calendário), então é erro de entrada.
  const declaredDates = (ticketDays ?? []).map((d) => d.date).filter((d): d is string => !!d);
  if (new Set(declaredDates).size !== declaredDates.length) {
    return { ok: false, error: "ticketDays: dois dias não podem ter a mesma data" };
  }

  const dayIds  = new Set((ticketDays ?? []).map((d) => d.id));
  const areaIds = new Set((ticketAreas ?? []).map((a) => a.id));

  const rawTypes = body.ticketTypes;
  if (!Array.isArray(rawTypes) || rawTypes.length === 0) {
    return { ok: false, error: "ticketTypes must be a non-empty array" };
  }

  const parsedTypes: ParsedTicketType[] = [];
  for (let i = 0; i < rawTypes.length; i++) {
    const t = rawTypes[i];
    const errPrefix = `ticketTypes[${i}]`;

    // `dayIds` é o formato atual (conjunto de dias — passe = mais de um).
    // `dayId` singular ainda é aceito: é o que clientes/rascunhos anteriores
    // à fatia de passes mandam, e converter aqui evita quebrá-los.
    const rawDayIds: unknown = t?.dayIds ?? (t?.dayId != null ? [t.dayId] : []);
    if (!Array.isArray(rawDayIds) || rawDayIds.some((d) => typeof d !== "string" || !d)) {
      return { ok: false, error: `${errPrefix}.dayIds must be an array of non-empty ids` };
    }
    const typeDayIds = [...new Set(rawDayIds as string[])];
    for (const d of typeDayIds) {
      if (!dayIds.has(d)) {
        return { ok: false, error: `${errPrefix}.dayIds contains an id that is not in ticketDays` };
      }
    }
    // Evento COM dias exige que todo tipo diga a quais dias pertence — um
    // tipo sem dia nenhum não apareceria em grupo algum na página do evento
    // e viraria um ingresso invendável.
    if (ticketDays && ticketDays.length > 0 && typeDayIds.length === 0) {
      return { ok: false, error: `${errPrefix}.dayIds must not be empty when the event declares days` };
    }

    const areaId = t?.areaId ?? null;
    if (areaId !== null && !areaIds.has(areaId)) {
      return { ok: false, error: `${errPrefix}.areaId does not match any entry in ticketAreas` };
    }

    let earlyEntryMinutes: number | null = null;
    if (t?.earlyEntryMinutes !== undefined && t?.earlyEntryMinutes !== null && t?.earlyEntryMinutes !== "") {
      earlyEntryMinutes = Number(t.earlyEntryMinutes);
      if (!Number.isInteger(earlyEntryMinutes) || earlyEntryMinutes < 0 || earlyEntryMinutes > MAX_EARLY_ENTRY_MINUTES) {
        return { ok: false, error: `${errPrefix}.earlyEntryMinutes must be an integer between 0 and ${MAX_EARLY_ENTRY_MINUTES}` };
      }
      if (earlyEntryMinutes === 0) earlyEntryMinutes = null; // 0 = sem perk
    }
    const lotNumber = Number.isInteger(t?.lotNumber) && t.lotNumber >= 1 ? t.lotNumber : 1;
    const priceUsdc = Number(t?.priceUsdc);
    if (!Number.isFinite(priceUsdc) || priceUsdc <= 0) {
      return { ok: false, error: `${errPrefix}.priceUsdc must be a positive number` };
    }
    let quantity: number | null = null;
    if (t?.quantity !== undefined && t?.quantity !== null && t?.quantity !== "") {
      quantity = Number(t.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return { ok: false, error: `${errPrefix}.quantity must be a positive integer, or omitted` };
      }
    }
    let salesEndAt: Date | null = null;
    if (t?.salesEndAt) {
      salesEndAt = new Date(t.salesEndAt);
      if (Number.isNaN(salesEndAt.getTime())) {
        return { ok: false, error: `${errPrefix}.salesEndAt is invalid` };
      }
    }
    const label = typeof t?.label === "string" && t.label.trim() ? t.label.trim() : `Tipo ${i + 1}`;
    parsedTypes.push({ dayIds: typeDayIds, areaId, lotNumber, label, priceUsdc, quantity, salesEndAt, earlyEntryMinutes });
  }

  // Dois lotes com o mesmo número dentro do mesmo grupo (mesmo conjunto de
  // dias + área) deixariam "qual é o lote ativo" na sorte da ordenação —
  // resolveActiveTicketType desempata por lotNumber. Ficou mais fácil de
  // acontecer com passes, onde o mesmo dia aparece em vários grupos.
  const lotSeen = new Set<string>();
  for (const t of parsedTypes) {
    const key = `${[...t.dayIds].sort().join("|")}::${t.areaId ?? ""}::${t.lotNumber}`;
    if (lotSeen.has(key)) {
      return { ok: false, error: `ticketTypes: dois lotes com o mesmo número no mesmo grupo (${t.label})` };
    }
    lotSeen.add(key);
  }

  // "A partir de R$X" — PLANO_EVOLUCAO_V2.md §5.1/A8: nunca um lote
  // esgotado/vencido. maxTickets agregado só existe se TODO tipo tem cota
  // própria — um tipo "sem cota" torna o teto do evento sem sentido.
  const now = Date.now();
  const eligiblePrices = parsedTypes
    .filter((t) => (t.salesEndAt === null || t.salesEndAt.getTime() > now) && (t.quantity === null || t.quantity > 0))
    .map((t) => t.priceUsdc);
  const priceUsdc = Math.min(...(eligiblePrices.length ? eligiblePrices : parsedTypes.map((t) => t.priceUsdc)));
  const maxTickets = parsedTypes.every((t) => t.quantity !== null)
    ? parsedTypes.reduce((sum, t) => sum + (t.quantity ?? 0), 0)
    : null;

  return { ok: true, matrix: { ticketDays, ticketAreas, ticketTypes: parsedTypes, priceUsdc, maxTickets } };
}
