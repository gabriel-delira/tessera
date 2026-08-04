import { describe, it, expect } from "vitest";
import { hashAchievements, type Achievement } from "@/lib/achievements";

/**
 * Domain (PLANO_EVOLUCAO_V2.md §6.3/D16, escopo off-chain): hash de
 * atestado determinístico sobre as conquistas alcançadas + wallet — sem
 * gravação on-chain nesta fatia (ver decisão no doc). Qualquer um deve
 * poder recomputar computeAchievements(wallet) e conferir que o hash bate.
 */
const achievements: Achievement[] = [
  { id: "voce-esteve-la", icon: "quadrifolio", title: "x", description: "x", achieved: true },
  { id: "primeiro-evento", icon: "portal", title: "x", description: "x", achieved: true },
  { id: "eventos-3", icon: "ticket", title: "x", description: "x", achieved: false },
];

describe("lib/achievements — hashAchievements (atestado off-chain)", () => {
  it("é determinístico pra mesma wallet e mesmo conjunto de conquistas", () => {
    expect(hashAchievements(achievements, "0xABC")).toBe(hashAchievements(achievements, "0xABC"));
  });

  it("ignora ordem de entrada das conquistas (ids são ordenados antes do hash)", () => {
    const shuffled = [achievements[1], achievements[0], achievements[2]];
    expect(hashAchievements(shuffled, "0xABC")).toBe(hashAchievements(achievements, "0xABC"));
  });

  it("é case-insensitive pra wallet (endereços vêm em formatos variados)", () => {
    expect(hashAchievements(achievements, "0xabc")).toBe(hashAchievements(achievements, "0xABC"));
  });

  it("carteiras diferentes com o mesmo conjunto de conquistas não colidem", () => {
    expect(hashAchievements(achievements, "0xAAA")).not.toBe(hashAchievements(achievements, "0xBBB"));
  });

  it("conjuntos de conquistas diferentes não colidem pra mesma wallet", () => {
    const fewer = achievements.map((a) => (a.id === "primeiro-evento" ? { ...a, achieved: false } : a));
    expect(hashAchievements(fewer, "0xABC")).not.toBe(hashAchievements(achievements, "0xABC"));
  });

  it("tem o prefixo sha256: pra deixar explícito como recomputar", () => {
    expect(hashAchievements(achievements, "0xABC")).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
