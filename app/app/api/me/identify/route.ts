import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { isValidCpf } from "@/lib/kyc";

// LAYOUT_UPDATE.md §5.6.1 — identificação (CPF), exigida na 1a compra.
// Não é KYC completo: baixo custo, quase sem atrito.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const cpf = String((body as { cpf?: string }).cpf ?? "").replace(/\D/g, "");

  if (!isValidCpf(cpf)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  if (user.cpf && user.cpf !== cpf) {
    return NextResponse.json({ error: "CPF não confere com o cadastro desta conta" }, { status: 409 });
  }

  const existing = await prisma.user.findUnique({ where: { cpf } });
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "CPF já cadastrado em outra conta" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      cpf,
      kycLevel: user.kycLevel === "NONE" ? "IDENTIFIED" : user.kycLevel,
    },
  });

  return NextResponse.json({ ok: true, kycLevel: updated.kycLevel });
}
