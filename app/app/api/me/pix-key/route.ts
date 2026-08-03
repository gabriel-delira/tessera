import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { mail } from "@/lib/mail";

// LAYOUT_UPDATE.md §5.7.1 — trocar a chave PIX é ação de alto risco (conta
// invadida vira desvio de dinheiro). getAuthUser já exige um token Privy
// válido e recente a cada chamada — é a reautenticação; o aviso por e-mail
// é o segundo controle.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { pixKey } = body as { pixKey?: string };
  if (!pixKey || pixKey.trim().length < 3) {
    return NextResponse.json({ error: "pixKey inválida" }, { status: 400 });
  }

  const previous = user.pixKey;
  await prisma.user.update({
    where: { id: user.id },
    data: { pixKey: pixKey.trim(), pixKeyUpdatedAt: new Date() },
  });

  if (user.email) {
    await mail.send({
      to: user.email,
      subject: "Sua chave PIX de recebimento foi alterada",
      body: previous
        ? `A chave PIX cadastrada na sua conta Tessera mudou. Se não foi você, entre em contato imediatamente.`
        : `Uma chave PIX foi cadastrada na sua conta Tessera para receber pagamentos de revenda.`,
    });
  }

  return NextResponse.json({ ok: true });
}
