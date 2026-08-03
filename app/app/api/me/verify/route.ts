import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { kyc } from "@/lib/kyc";

// LAYOUT_UPDATE.md §5.6.1 — KYC completo, exigido no 1o anúncio de revenda
// (nunca antes: comprar, listar até aqui e usar o app seguem sem barreira).
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { cpf: rawCpf, fullName } = body as { cpf?: string; fullName?: string };
  const cpf = String(rawCpf ?? user.cpf ?? "").replace(/\D/g, "");

  if (!cpf) {
    return NextResponse.json({ error: "CPF é obrigatório" }, { status: 400 });
  }
  if (user.cpf && user.cpf !== cpf) {
    return NextResponse.json({ error: "CPF não confere com o cadastro desta conta" }, { status: 409 });
  }

  const result = await kyc.submitFullVerification({ cpf, fullName: fullName ?? "" });
  if (!result.approved) {
    return NextResponse.json({ error: result.reason ?? "Verificação não aprovada" }, { status: 422 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { cpf, kycLevel: "VERIFIED", kycVerifiedAt: new Date() },
  });

  return NextResponse.json({ ok: true, kycLevel: updated.kycLevel });
}
