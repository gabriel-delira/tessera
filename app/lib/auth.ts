import { NextRequest } from "next/server";
import { privy } from "@/lib/privy";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import { DEV_PERSONA_COOKIE, isDevAuthEnabled, isLocalPersonaId } from "@/lib/devAuth";

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const devUser = await getDevPersonaUser(req);
  if (devUser) return devUser;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  let claims;
  try {
    claims = await privy.verifyAuthToken(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { privyId: claims.userId } });
  return user;
}

/**
 * DEV ONLY — resolve a persona assumida via cookie, sem passar pelo Privy.
 *
 * Retorna null sempre que o ambiente não é local, o que faz getAuthUser cair
 * no fluxo normal de token. Ver lib/devAuth.ts para os gates; note que este
 * caminho é somente leitura (findUnique), então assumir uma persona nunca
 * escreve no banco — em particular, nunca sobrescreve walletAddress, que é o
 * campo que amarra os ingressos semeados ao dono.
 */
async function getDevPersonaUser(req: NextRequest): Promise<User | null> {
  if (!isDevAuthEnabled()) return null;

  const privyId = req.cookies.get(DEV_PERSONA_COOKIE)?.value;
  if (!isLocalPersonaId(privyId)) return null;

  return prisma.user.findUnique({ where: { privyId } });
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

export function blockedResponse() {
  return Response.json({ error: "Conta bloqueada", code: "ACCOUNT_BLOCKED" }, { status: 403 });
}
