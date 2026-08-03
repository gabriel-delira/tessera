import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  DEV_PERSONA_COOKIE,
  LOCAL_PRIVY_PREFIX,
  isDevAuthEnabled,
  isLocalPersonaId,
} from "@/lib/devAuth";

// DEV ONLY — troca a persona ativa entre os usuários semeados por prisma/seed.ts.
// Ver lib/devAuth.ts para os dois gates. Quando o gate de ambiente está fechado
// as três verbs respondem 404, como se a rota não existisse.

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/** Lista as personas disponíveis e qual está ativa. */
export async function GET(req: NextRequest) {
  if (!isDevAuthEnabled()) return notFound();

  const personas = await prisma.user.findMany({
    where: { privyId: { startsWith: LOCAL_PRIVY_PREFIX } },
    select: {
      privyId: true,
      email: true,
      role: true,
      displayName: true,
      walletAddress: true,
      kycLevel: true,
    },
    orderBy: { privyId: "asc" },
  });

  // Ingressos se ligam ao usuário por ownerAddress (não por userId), então a
  // contagem espelha exatamente o que a tela "Minha Coleção" vai mostrar.
  const withCounts = await Promise.all(
    personas.map(async (p) => ({
      ...p,
      ticketCount: p.walletAddress
        ? await prisma.ticket.count({ where: { ownerAddress: p.walletAddress } })
        : 0,
    })),
  );

  const current = req.cookies.get(DEV_PERSONA_COOKIE)?.value ?? null;

  return NextResponse.json({
    current: isLocalPersonaId(current) ? current : null,
    personas: withCounts,
  });
}

/** Assume uma persona. Body: { privyId }. */
export async function POST(req: NextRequest) {
  if (!isDevAuthEnabled()) return notFound();

  const { privyId } = await req.json().catch(() => ({ privyId: null }));

  // Gate estrutural: sem o prefixo não chega nem a consultar o banco, então
  // esta rota não tem como devolver sessão para um usuário real do Privy.
  if (!isLocalPersonaId(privyId)) {
    return NextResponse.json(
      { error: `privyId deve começar com "${LOCAL_PRIVY_PREFIX}"` },
      { status: 400 },
    );
  }

  // isLocalPersonaId já garantiu o prefixo, então a busca exata não consegue
  // resolver para um usuário fora do conjunto semeado.
  const persona = await prisma.user.findUnique({ where: { privyId } });

  if (!persona) {
    return NextResponse.json({ error: "Persona não encontrada" }, { status: 404 });
  }

  const res = NextResponse.json({ persona });
  res.cookies.set(DEV_PERSONA_COOKIE, privyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

/** Abandona a persona (volta ao estado deslogado). */
export async function DELETE() {
  if (!isDevAuthEnabled()) return notFound();

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEV_PERSONA_COOKIE);
  return res;
}
