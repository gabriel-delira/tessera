/**
 * Os gates do bypass de autenticação local (lib/devAuth.ts).
 *
 * Este arquivo existe para que apagar ou afrouxar um dos gates quebre o CI em
 * vez de passar despercebido: o bypass dá sessão sem verificar token, então a
 * única coisa que o separa de um buraco de autenticação são estas condições.
 */
import { describe, expect, it, afterEach } from "vitest";
import { isDevAuthEnabled, isLocalPersonaId, LOCAL_PRIVY_PREFIX } from "@/lib/devAuth";

const originalAppEnv = process.env.APP_ENV;

afterEach(() => {
  if (originalAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = originalAppEnv;
});

describe("gate de ambiente", () => {
  it("liga apenas com APP_ENV exatamente 'local'", () => {
    process.env.APP_ENV = "local";
    expect(isDevAuthEnabled()).toBe(true);
  });

  it("fica desligado quando APP_ENV não está definido", () => {
    delete process.env.APP_ENV;
    expect(isDevAuthEnabled()).toBe(false);
  });

  // Allowlist positiva: qualquer valor que não seja "local" mantém desligado,
  // inclusive os que parecem inofensivos ou contêm a palavra.
  it.each(["production", "staging", "preview", "development", "test", "LOCAL", "local-ish", ""])(
    "fica desligado com APP_ENV=%j",
    (value) => {
      process.env.APP_ENV = value;
      expect(isDevAuthEnabled()).toBe(false);
    },
  );
});

describe("gate estrutural de persona", () => {
  it("aceita ids semeados", () => {
    expect(isLocalPersonaId("local-admin")).toBe(true);
    expect(isLocalPersonaId("local-buyer-empty")).toBe(true);
  });

  // O ponto central: um id vindo do Privy nunca pode ser aceito, senão o
  // bypass viraria uma forma de personificar um usuário real.
  it("rejeita ids do Privy", () => {
    expect(isLocalPersonaId("did:privy:cmxyz123")).toBe(false);
  });

  it.each([undefined, null, "", "admin", "Local-admin", " local-admin"])(
    "rejeita %j",
    (value) => {
      expect(isLocalPersonaId(value as string | null | undefined)).toBe(false);
    },
  );

  it("não aceita o prefixo embutido em outra posição", () => {
    expect(isLocalPersonaId(`did:privy:${LOCAL_PRIVY_PREFIX}admin`)).toBe(false);
  });
});
