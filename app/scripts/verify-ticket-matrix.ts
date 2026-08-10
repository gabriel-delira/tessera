/**
 * Validação de ponta a ponta da matriz de ingressos: evento de vários dias,
 * com ingresso por dia, passe completo, passe parcial e entrada antecipada.
 * Roda contra o Postgres de dev e limpa o que criou.
 *
 *   npm run verify:ticket-matrix
 *
 * Exige o Postgres de dev no ar (`docker compose up -d db`). Use 127.0.0.1 e
 * não `localhost` no DATABASE_URL: o driver node-postgres tenta ::1 primeiro
 * e o container só publica em IPv4.
 *
 * Não é um teste de unidade: o objetivo é exercitar o caminho REAL de criação
 * (o mesmo `parseTicketMatrix` que a API usa -> gravação no banco -> os mesmos
 * `listGroups`/`resolveActiveTicketType` que a página do evento e o checkout
 * usam), que a suíte com infra mockada não cobre.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseTicketMatrix } from "@/lib/ticketMatrixInput";
import { listGroups, resolveActiveTicketType, groupKey, isPass, groupDayNames } from "@/lib/ticketMatrix";
import { resolveEventDay, resolveDoorsOpenAt, NO_DAY } from "@/lib/eventDay";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

// 3 dias consecutivos, com data — é a data que permite a portaria saber qual
// dia do evento é hoje.
const DAYS = [
  { id: "day1", name: "Sexta",  date: "2026-12-04" },
  { id: "day2", name: "Sábado", date: "2026-12-05" },
  { id: "day3", name: "Domingo", date: "2026-12-06" },
];

// Exatamente o corpo que o Step 2 do NewEventModal monta: 3 ingressos de dia
// único + passe completo + passe ultra (todos os dias E 1h antes).
const BODY = {
  ticketDays: DAYS,
  ticketAreas: null,
  ticketTypes: [
    { dayIds: ["day1"], areaId: null, lotNumber: 1, label: "Sexta",   priceUsdc: 30, quantity: 100, salesEndAt: null },
    { dayIds: ["day2"], areaId: null, lotNumber: 1, label: "Sábado",  priceUsdc: 40, quantity: 100, salesEndAt: null },
    { dayIds: ["day3"], areaId: null, lotNumber: 1, label: "Domingo", priceUsdc: 35, quantity: 100, salesEndAt: null },
    { dayIds: ["day1", "day2", "day3"], areaId: null, lotNumber: 1, label: "Passe completo", priceUsdc: 90, quantity: 50, salesEndAt: null },
    { dayIds: ["day1", "day2", "day3"], areaId: null, lotNumber: 1, label: "Passe ultra", priceUsdc: 150, quantity: 20, salesEndAt: null, earlyEntryMinutes: 60 },
  ],
};

async function main() {
  console.log("\n1. parseTicketMatrix (mesma validação que a API de criação usa)");

  // O ultra colide com o passe completo: mesmo conjunto de dias, mesma área,
  // mesmo lote. É exatamente a colisão que a validação de lote deve pegar.
  const colliding = parseTicketMatrix(BODY);
  check("recusa dois tipos no mesmo grupo com o mesmo lote", !colliding.ok, colliding.ok ? undefined : colliding.error);

  // Corrigido: o ultra é o lote 2 do mesmo grupo... mas aí ele nunca ficaria
  // ativo enquanto o lote 1 tivesse cota. Passe ultra é um PRODUTO distinto,
  // então o que o organizador faria de verdade é dar a ele uma área própria.
  const body = {
    ...BODY,
    ticketAreas: [
      { id: "areaStd", name: "Padrão" },
      { id: "areaUltra", name: "Ultra" },
    ],
    ticketTypes: [
      ...BODY.ticketTypes.slice(0, 4).map((t) => ({ ...t, areaId: "areaStd" })),
      { ...BODY.ticketTypes[4], areaId: "areaUltra" },
    ],
  };

  const parsed = parseTicketMatrix(body);
  check("aceita a matriz corrigida", parsed.ok, parsed.ok ? undefined : parsed.error);
  if (!parsed.ok) throw new Error("parse falhou, abortando");

  check("preço 'a partir de' é o menor elegível (30)", parsed.matrix.priceUsdc === 30, parsed.matrix.priceUsdc);
  check("maxTickets agregado soma as cotas (370)", parsed.matrix.maxTickets === 370, parsed.matrix.maxTickets);
  check(
    "earlyEntryMinutes preservado só no ultra",
    parsed.matrix.ticketTypes.filter((t) => t.earlyEntryMinutes === 60).length === 1
  );

  console.log("\n2. gravação no banco");
  const organizer = await prisma.organizer.findFirst({ where: { status: "APPROVED" } });
  if (!organizer) throw new Error("nenhum organizador APPROVED — rode `npm run db:seed` antes");

  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: "[verify] Evento multi-dia",
      venue: "São Paulo Expo", city: "São Paulo", state: "SP",
      eventDate: new Date("2026-12-04T13:00:00Z"),
      endDate:   new Date("2026-12-06T23:00:00Z"),
      doorsOpenAt: new Date("2026-12-04T13:00:00Z"), // 10h de Brasília
      ticketPriceUsdc: parsed.matrix.priceUsdc,
      maxTickets: parsed.matrix.maxTickets,
      category: "CONFERENCIA",
      status: "ON_SALE",
      ticketDays:  parsed.matrix.ticketDays as never,
      ticketAreas: parsed.matrix.ticketAreas as never,
      ticketTypes: {
        create: parsed.matrix.ticketTypes.map((t) => ({
          label: t.label, priceUsdc: t.priceUsdc, quantity: t.quantity,
          salesEndAt: t.salesEndAt, dayIds: t.dayIds, areaId: t.areaId,
          lotNumber: t.lotNumber, earlyEntryMinutes: t.earlyEntryMinutes,
        })),
      },
    },
    include: { ticketTypes: true },
  });
  check("evento criado com 5 tipos", event.ticketTypes.length === 5, event.ticketTypes.length);
  check(
    "dayIds sobreviveram ao round-trip no Postgres",
    event.ticketTypes.filter((t) => t.dayIds.length === 3).length === 2
  );

  try {
    console.log("\n3. agrupamento (o que a página do evento oferece)");
    const groups = listGroups(event.ticketTypes);
    // 3 dias únicos (areaStd) + passe completo (areaStd) + passe ultra (areaUltra)
    check("5 grupos distintos", groups.length === 5, groups.length);
    check("2 grupos são passe", groups.filter((g) => isPass(g.dayIds)).length === 2);

    const ultra = groups.find((g) => g.areaId === "areaUltra")!;
    check("passe ultra cobre os 3 dias", ultra.dayIds.length === 3, ultra.dayIds);
    check(
      "nomes dos dias resolvem na ordem",
      groupDayNames(ultra.dayIds, DAYS).join(",") === "Sexta,Sábado,Domingo",
      groupDayNames(ultra.dayIds, DAYS)
    );

    console.log("\n4. lote ativo (o que o checkout resolve)");
    for (const g of groups) {
      const active = await resolveActiveTicketType(event.id, g.dayIds, g.areaId, event.ticketTypes);
      check(`grupo ${groupKey(g.dayIds, g.areaId)} tem lote ativo`, active !== null);
    }
    const activeUltra = await resolveActiveTicketType(event.id, ultra.dayIds, ultra.areaId, event.ticketTypes);
    check("checkout do ultra acha o tipo certo", activeUltra?.label === "Passe ultra", activeUltra?.label);
    check("ordem dos dias invertida resolve o MESMO tipo",
      (await resolveActiveTicketType(event.id, ["day3", "day1", "day2"], "areaUltra", event.ticketTypes))?.id === activeUltra?.id);

    console.log("\n5. portaria: passe entra nos 3 dias");
    for (const d of DAYS) {
      // 15h de Brasília do dia em questão.
      const now = new Date(`${d.date}T18:00:00Z`);
      const res = resolveEventDay(event.ticketDays, now);
      const resolvedId = res.kind === "resolved" ? res.dayId : NO_DAY;
      check(`${d.name}: dia resolvido`, resolvedId === d.id, res);
      check(`${d.name}: passe cobre`, ultra.dayIds.includes(resolvedId));
      // Ingresso de dia único só entra no próprio dia.
      const single = event.ticketTypes.find((t) => t.dayIds.length === 1 && t.dayIds[0] === "day1")!;
      const singleOk = single.dayIds.includes(resolvedId);
      check(`${d.name}: ingresso de Sexta ${d.id === "day1" ? "entra" : "é barrado"}`, singleOk === (d.id === "day1"));
    }

    console.log("\n6. portão e entrada antecipada");
    const doorsDay3 = resolveDoorsOpenAt(event.doorsOpenAt, event.ticketDays, "day3");
    check("portão do dia 3 é 06/12 às 10h BRT",
      doorsDay3?.toISOString() === "2026-12-06T13:00:00.000Z", doorsDay3?.toISOString());

    const ultraType = event.ticketTypes.find((t) => t.earlyEntryMinutes === 60)!;
    const allowedUltra = new Date(doorsDay3!.getTime() - ultraType.earlyEntryMinutes! * 60_000);
    const at0930 = new Date("2026-12-06T12:30:00Z"); // 09:30 BRT
    check("ultra entra 09:30 (1h antes)", at0930.getTime() >= allowedUltra.getTime());
    const stdType = event.ticketTypes.find((t) => t.label === "Domingo")!;
    const allowedStd = new Date(doorsDay3!.getTime() - (stdType.earlyEntryMinutes ?? 0) * 60_000);
    check("comum é barrado 09:30", at0930.getTime() < allowedStd.getTime());
    check("ultra é barrado 08:30 (fora da janela)",
      new Date("2026-12-06T11:30:00Z").getTime() < allowedUltra.getTime());
  } finally {
    await prisma.ticketType.deleteMany({ where: { eventId: event.id } });
    await prisma.event.delete({ where: { id: event.id } });
    console.log("\n(evento de teste removido)");
  }

  console.log(failures === 0 ? "\nTUDO OK\n" : `\n${failures} FALHA(S)\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
