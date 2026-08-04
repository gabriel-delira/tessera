import { describe, it, expect } from "vitest";
import { getSocialHalfQuotaBps, socialHalfCap, DEFAULT_QUOTA_BPS } from "@/lib/socialHalfQuota";

/**
 * Domain (PLANO_EVOLUCAO_V2.md §5.5/D24): cota de meia-entrada configurável
 * por UF, com fallback para o país e depois para o default (40%, teto da
 * Lei 12.933/2013 adotado como piso operacional).
 */
describe("lib/socialHalfQuota — hierarquia UF > país > default", () => {
  it("usa a cota da UF quando ela existe na tabela", () => {
    expect(getSocialHalfQuotaBps("BR", "SP")).toBe(4000);
  });

  it("cai para a cota do país quando a UF não tem regra própria", () => {
    expect(getSocialHalfQuotaBps("BR", "RJ")).toBe(4000);
    expect(getSocialHalfQuotaBps("BR", null)).toBe(4000);
  });

  it("cai para o default quando nem UF nem país têm regra", () => {
    expect(getSocialHalfQuotaBps("XX", null)).toBe(DEFAULT_QUOTA_BPS);
    expect(getSocialHalfQuotaBps(null, null)).toBe(DEFAULT_QUOTA_BPS);
  });

  it("UF é case-insensitive", () => {
    expect(getSocialHalfQuotaBps("br", "sp")).toBe(getSocialHalfQuotaBps("BR", "SP"));
  });
});

describe("lib/socialHalfQuota — socialHalfCap", () => {
  it("retorna null quando o evento não tem maxTickets", () => {
    expect(socialHalfCap({ maxTickets: null, country: "BR", state: null })).toBeNull();
  });

  it("arredonda para baixo — nunca a favor de mais meias que a cota permite", () => {
    // 101 * 40% = 40.4 -> 40, não 41
    expect(socialHalfCap({ maxTickets: 101, country: "BR", state: "SP" })).toBe(40);
  });

  it("calcula 40% exato quando a divisão é redonda", () => {
    expect(socialHalfCap({ maxTickets: 100, country: "BR", state: null })).toBe(40);
  });
});
