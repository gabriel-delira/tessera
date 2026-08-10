import { describe, it, expect } from "vitest";
import { listGroups, groupKey, daySetKey, isPass, groupDayNames, type TicketTypeRow } from "@/lib/ticketMatrix";

/**
 * Domain: a matriz de ingressos agrupa por CONJUNTO de dias × área. Um passe
 * é um TicketType com mais de um dia — não uma entidade separada. O
 * agrupamento é o que a página do evento vira em opções de compra, e o que o
 * checkout usa pra achar o lote ativo; os dois precisam concordar.
 */
const row = (over: Partial<TicketTypeRow> & { id: string }): TicketTypeRow => ({
  dayIds: [], areaId: null, lotNumber: 1, quantity: null, salesEndAt: null, ...over,
});

describe("lib/ticketMatrix — chave de grupo", () => {
  it("a ordem dos dias não muda o grupo", () => {
    // Regressão: [d2,d1] e [d1,d2] são o MESMO passe. Sem ordenar, dois lotes
    // do mesmo passe cairiam em grupos distintos e o comprador veria a opção
    // duplicada.
    expect(daySetKey(["d2", "d1"])).toBe(daySetKey(["d1", "d2"]));
    expect(groupKey(["d2", "d1"], "a1")).toBe(groupKey(["d1", "d2"], "a1"));
  });

  it("área diferente é grupo diferente", () => {
    expect(groupKey(["d1"], "pista")).not.toBe(groupKey(["d1"], "camarote"));
  });

  it("conjunto de dias diferente é grupo diferente", () => {
    // Passe completo e passe parcial não podem colidir.
    expect(groupKey(["d1", "d2", "d3"], null)).not.toBe(groupKey(["d1", "d2"], null));
  });
});

describe("lib/ticketMatrix — listGroups", () => {
  it("agrupa lotes do mesmo passe numa opção só", () => {
    const types = [
      row({ id: "t1", dayIds: ["d1", "d2"], lotNumber: 1 }),
      row({ id: "t2", dayIds: ["d2", "d1"], lotNumber: 2 }), // mesma coisa, ordem trocada
    ];
    expect(listGroups(types)).toHaveLength(1);
  });

  it("separa dia único de passe que contém aquele dia", () => {
    const types = [
      row({ id: "t1", dayIds: ["d1"] }),
      row({ id: "t2", dayIds: ["d2"] }),
      row({ id: "t3", dayIds: ["d1", "d2"] }),
    ];
    const groups = listGroups(types);
    expect(groups).toHaveLength(3);
    expect(groups.filter((g) => g.dayIds.length > 1)).toHaveLength(1);
  });

  it("evento sem dimensão de dia dá um grupo só", () => {
    expect(listGroups([row({ id: "t1" }), row({ id: "t2", lotNumber: 2 })])).toEqual([
      { dayIds: [], areaId: null },
    ]);
  });

  it("dias × áreas produzem o produto cartesiano", () => {
    const types = [
      row({ id: "a", dayIds: ["d1"], areaId: "pista" }),
      row({ id: "b", dayIds: ["d1"], areaId: "camarote" }),
      row({ id: "c", dayIds: ["d2"], areaId: "pista" }),
      row({ id: "d", dayIds: ["d2"], areaId: "camarote" }),
    ];
    expect(listGroups(types)).toHaveLength(4);
  });
});

describe("lib/ticketMatrix — isPass", () => {
  it("passe é o que cobre mais de um dia", () => {
    expect(isPass(["d1", "d2"])).toBe(true);
    expect(isPass(["d1"])).toBe(false);
    // Evento de data única não é "passe de zero dias".
    expect(isPass([])).toBe(false);
  });
});

describe("lib/ticketMatrix — groupDayNames", () => {
  const days = [
    { id: "d1", name: "Sexta" },
    { id: "d2", name: "Sábado" },
  ];

  it("resolve os nomes na ordem do conjunto", () => {
    expect(groupDayNames(["d1", "d2"], days)).toEqual(["Sexta", "Sábado"]);
  });

  it("ignora id que não existe mais em vez de renderizar undefined", () => {
    expect(groupDayNames(["d1", "sumiu"], days)).toEqual(["Sexta"]);
  });
});
