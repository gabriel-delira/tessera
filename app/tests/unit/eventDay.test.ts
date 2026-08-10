import { describe, it, expect } from "vitest";
import { resolveEventDay, calendarDateInEventTz, resolveDoorsOpenAt, NO_DAY } from "@/lib/eventDay";

/**
 * Domain: check-in por dia do evento. `resolveEventDay` responde "qual dia
 * deste evento é agora", que é o que decide se o ingresso do Dia 2 pode
 * entrar hoje e sob qual dayId o Checkin é gravado.
 *
 * O horário de Brasília (UTC-3) é o "hoje" da portaria, não o UTC do
 * servidor — por isso os instantes dos testes são construídos em UTC e
 * comparados contra a data local esperada.
 */
const DAYS = [
  { id: "d1", name: "Dia 1", date: "2026-08-10" },
  { id: "d2", name: "Dia 2", date: "2026-08-11" },
  { id: "d3", name: "Dia 3", date: "2026-08-12" },
];

describe("lib/eventDay — data de calendário no fuso do evento", () => {
  it("usa o horário de Brasília, não o UTC do servidor", () => {
    // 2026-08-11T01:00Z = 2026-08-10 22:00 em São Paulo (UTC-3).
    expect(calendarDateInEventTz(new Date("2026-08-11T01:00:00Z"))).toBe("2026-08-10");
  });
});

describe("lib/eventDay — resolveEventDay", () => {
  it("evento sem dimensão de dia cai em no_days", () => {
    expect(resolveEventDay(null)).toEqual({ kind: "no_days" });
    expect(resolveEventDay([])).toEqual({ kind: "no_days" });
  });

  it("resolve o dia cuja data de calendário é hoje", () => {
    // 15h em São Paulo no dia 11.
    const r = resolveEventDay(DAYS, new Date("2026-08-11T18:00:00Z"));
    expect(r).toEqual({ kind: "resolved", dayId: "d2" });
  });

  it("madrugada ainda conta como a noite do dia anterior", () => {
    // 2026-08-13T05:00Z = 02:00 do dia 13 em São Paulo. O dia 13 não é dia
    // do evento, mas o dia 12 é — quem está dentro desde as 22h do dia 12
    // não pode ser barrado ao voltar do lado de fora às 02h.
    const r = resolveEventDay(DAYS, new Date("2026-08-13T05:00:00Z"));
    expect(r).toEqual({ kind: "resolved", dayId: "d3" });
  });

  it("madrugada NÃO rouba o dia quando hoje já é um dia declarado", () => {
    // 02:00 do dia 11 (que é o Dia 2). Tem que resolver pro dia 2, não
    // carregar pro dia 1 — em evento de dias consecutivos a madrugada do
    // dia seguinte é o próprio dia seguinte.
    const r = resolveEventDay(DAYS, new Date("2026-08-11T05:00:00Z"));
    expect(r).toEqual({ kind: "resolved", dayId: "d2" });
  });

  it("fora de qualquer dia do evento devolve outside com a data de hoje", () => {
    const r = resolveEventDay(DAYS, new Date("2026-09-01T15:00:00Z"));
    expect(r).toEqual({ kind: "outside", today: "2026-09-01" });
  });

  it("depois do corte da madrugada, o dia anterior não é mais carregado", () => {
    // 2026-08-13T12:00Z = 09:00 do dia 13 em SP — passou das 6h.
    const r = resolveEventDay(DAYS, new Date("2026-08-13T12:00:00Z"));
    expect(r).toEqual({ kind: "outside", today: "2026-08-13" });
  });

  it("evento multi-dia legado (sem datas gravadas) não trava a portaria", () => {
    const legacy = [{ id: "d1", name: "Dia 1" }, { id: "d2", name: "Dia 2" }];
    expect(resolveEventDay(legacy, new Date("2026-08-11T18:00:00Z"))).toEqual({ kind: "legacy_undated" });
  });

  it("passe cobre vários dias: o mesmo conjunto resolve em qualquer um deles", () => {
    // Não é resolveEventDay que decide isso (ele só diz que dia é hoje), mas
    // deixa explícito o contrato que a rota de check-in usa pro passe.
    const d1 = resolveEventDay(DAYS, new Date("2026-08-10T18:00:00Z"));
    const d3 = resolveEventDay(DAYS, new Date("2026-08-12T18:00:00Z"));
    expect(d1).toEqual({ kind: "resolved", dayId: "d1" });
    expect(d3).toEqual({ kind: "resolved", dayId: "d3" });
    const passDayIds = ["d1", "d2", "d3"];
    expect(passDayIds).toContain("d1");
    expect(passDayIds).toContain("d3");
  });

  it("NO_DAY é string vazia — NULL quebraria a UNIQUE de Checkin", () => {
    // Regressão: no Postgres dois NULL são distintos dentro de um UNIQUE,
    // então (tokenId, NULL) deixaria passar dois check-ins do mesmo ingresso.
    expect(NO_DAY).toBe("");
  });
});

describe("lib/eventDay — resolveDoorsOpenAt (hora do portão por dia)", () => {
  // Portão às 10h de Brasília = 13:00Z.
  const doors = new Date("2026-08-10T13:00:00Z");

  it("sem portão declarado não há gate", () => {
    expect(resolveDoorsOpenAt(null, DAYS, "d1")).toBeNull();
  });

  it("evento de data única usa doorsOpenAt como está", () => {
    expect(resolveDoorsOpenAt(doors, null, NO_DAY)?.toISOString()).toBe("2026-08-10T13:00:00.000Z");
  });

  it("multi-dia: a HORA vem de doorsOpenAt e a DATA vem do dia do evento", () => {
    // Dia 3 é 12/08 — o portão daquele dia é 10h de Brasília do dia 12,
    // e não o timestamp do dia 10. Um evento de 3 dias abre o portão 3 vezes.
    expect(resolveDoorsOpenAt(doors, DAYS, "d3")?.toISOString()).toBe("2026-08-12T13:00:00.000Z");
  });

  it("a hora é lida no fuso do evento, não em UTC", () => {
    // Regressão: montar a data nova com getUTCHours() daria 10:00Z (07h de
    // Brasília) e abriria o portão três horas cedo.
    const d = resolveDoorsOpenAt(doors, DAYS, "d2")!;
    const hourInSp = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(d);
    expect(Number(hourInSp)).toBe(10);
  });
});
