// Bypass de autenticação SOMENTE para desenvolvimento local.
//
// Permite assumir uma das personas semeadas por prisma/seed.ts sem passar pelo
// Privy, para exercitar as telas de cada role (ADMIN, ORGANIZER, STAFF, BUYER
// com e sem ingressos) sem precisar de um usuário real por persona.
//
// Dois gates independentes, ambos obrigatórios:
//
//   1. APP_ENV === "local" — allowlist positiva, mesmo padrão de
//      app/api/dev/simulate-payment. NODE_ENV não serve: ambientes de
//      staging/preview podem rodar como "development" sem serem locais.
//   2. privyId com prefixo "local-" — todas as consultas deste módulo são
//      restritas a esse prefixo, então o bypass é estruturalmente incapaz de
//      autenticar um usuário vindo do Privy (cujo id é sempre "did:privy:...").
//
// Se o gate 1 falhar, as rotas respondem 404 e getAuthUser ignora o cookie.

/** Prefixo dos privyId semeados. Usuários reais do Privy usam "did:privy:...". */
export const LOCAL_PRIVY_PREFIX = "local-";

/** Cookie httpOnly que guarda o privyId da persona assumida. */
export const DEV_PERSONA_COOKIE = "tessera_dev_persona";

/** Gate 1: o bypass só existe quando explicitamente marcado como ambiente local. */
export function isDevAuthEnabled(): boolean {
  return process.env.APP_ENV === "local";
}

/** Gate 2: rejeita qualquer id que não seja de uma persona semeada. */
export function isLocalPersonaId(privyId: string | undefined | null): privyId is string {
  return typeof privyId === "string" && privyId.startsWith(LOCAL_PRIVY_PREFIX);
}
