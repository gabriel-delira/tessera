// Resolve QUAL dia de um evento multi-dia é "hoje" — a peça que faltava pra
// check-in por dia (Checkin.dayId). Sem isso a portaria não tem como saber se
// o ingresso de "Dia 2" está sendo apresentado no dia 2 ou no dia 1.
//
// A comparação é por data de CALENDÁRIO, nunca por instante: um evento que
// vira a madrugada (portão 22h, fim 4h) continua sendo "o dia que começou",
// e comparar timestamps faria o público das 00h30 ser barrado como se fosse
// o dia seguinte. Por isso `TicketDim.date` é "YYYY-MM-DD" puro.

import type { TicketDim } from "@/lib/ticketMatrixInput";

// Toda a operação é BR nesta fatia (CPF, PIX, meia-entrada, Event.country
// default "BR"), então o "hoje" da portaria é o horário de Brasília — não o
// UTC do servidor, que viraria o dia 21h no horário local e passaria a
// aceitar o ingresso de amanhã três horas antes.
export const EVENT_TZ = "America/Sao_Paulo";

// `en-CA` porque formata como "YYYY-MM-DD", o mesmo shape de TicketDim.date.
const DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function calendarDateInEventTz(instant: Date): string {
  return DATE_FMT.format(instant);
}

const HOUR_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: EVENT_TZ, hour: "2-digit", hour12: false });

// Até que horas a madrugada ainda conta como a noite anterior. Um evento de
// "Dia 1 = 10/08" com portão às 22h continua rolando às 02h do dia 11 — pela
// data de calendário pura o público das 02h seria barrado como se estivesse
// no dia errado. Quem sai pra fumar 01h30 e volta é o caso comum, não a
// exceção. 6h é o corte usual de "dia operacional" de casa noturna.
const NIGHT_OWL_CUTOFF_HOUR = 6;

function previousCalendarDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`); // meio-dia evita qualquer salto de DST
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Sentinela pra "evento sem dimensão de dia". String vazia, não null, porque
// é chave de UNIQUE em Checkin: no Postgres dois NULL são distintos entre si,
// então @@unique([tokenId, dayId]) com dayId null NÃO impediria dois check-ins
// do mesmo ingresso — exatamente a garantia que essa constraint existe pra dar.
export const NO_DAY = "";

export type DayResolution =
  | { kind: "no_days" }                       // evento sem dimensão de dia
  | { kind: "resolved"; dayId: string }       // hoje é este dia do evento
  | { kind: "legacy_undated" }                // evento multi-dia sem datas gravadas
  | { kind: "outside"; today: string };       // hoje não é nenhum dos dias

export function resolveEventDay(ticketDays: unknown, now: Date = new Date()): DayResolution {
  const days = (ticketDays as TicketDim[] | null) ?? [];
  if (days.length === 0) return { kind: "no_days" };

  // Evento multi-dia criado antes desta fatia: nenhum dia tem data, então não
  // dá pra dizer qual é hoje. Quem chama decide o fallback — barrar todo mundo
  // na porta de um evento legado seria pior que não validar o dia.
  if (days.every((d) => !d.date)) return { kind: "legacy_undated" };

  const today = calendarDateInEventTz(now);
  const exact = days.find((d) => d.date === today);
  if (exact) return { kind: "resolved", dayId: exact.id };

  // Madrugada: ainda é a noite do dia anterior (ver NIGHT_OWL_CUTOFF_HOUR).
  // Só entra aqui se HOJE não for um dia declarado — num evento de dias
  // consecutivos, 02h do dia 2 é o dia 2, não a madrugada do dia 1.
  if (Number(HOUR_FMT.format(now)) < NIGHT_OWL_CUTOFF_HOUR) {
    const yesterday = previousCalendarDate(today);
    const carried = days.find((d) => d.date === yesterday);
    if (carried) return { kind: "resolved", dayId: carried.id };
  }

  return { kind: "outside", today };
}

// Horário de abertura dos portões PARA UM DIA específico. `Event.doorsOpenAt`
// é um timestamp só, mas um evento de 3 dias abre o portão nos 3 — a leitura
// certa é "a HORA vem de doorsOpenAt, a DATA vem do dia do evento". Um evento
// que abre 10h todo dia é o caso comum, e é isso que essa combinação expressa.
//
// Sem dia resolvido (evento de data única), doorsOpenAt já é absoluto e vale
// como está. Sem doorsOpenAt, não há portão declarado — retorna null e quem
// chama não aplica gate nenhum.
export function resolveDoorsOpenAt(
  doorsOpenAt: Date | null,
  ticketDays: unknown,
  dayId: string
): Date | null {
  if (!doorsOpenAt) return null;
  if (dayId === NO_DAY) return doorsOpenAt;

  const days = (ticketDays as TicketDim[] | null) ?? [];
  const day = days.find((d) => d.id === dayId);
  if (!day?.date) return doorsOpenAt;

  // A hora de doorsOpenAt precisa ser lida no fuso do evento, não em UTC:
  // 10h de Brasília é 13h UTC, e montar a data nova com getUTCHours() abriria
  // o portão três horas cedo.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: EVENT_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(doorsOpenAt);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";

  return zonedDateTime(day.date, hh, mm);
}

// Constrói o instante UTC correspondente a "esta data, esta hora, no fuso do
// evento". Feito por tentativa e correção porque o JS não tem construtor de
// data com fuso nomeado — o offset (-03 hoje, -02 num eventual horário de
// verão) precisa ser descoberto a partir de um palpite.
function zonedDateTime(date: string, hh: string, mm: string): Date {
  const guess = new Date(`${date}T${hh}:${mm}:00Z`);
  const offsetMs = guess.getTime() - new Date(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: EVENT_TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(guess).replace(" ", "T") + "Z"
  ).getTime();
  return new Date(guess.getTime() + offsetMs);
}
