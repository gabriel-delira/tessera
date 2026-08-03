import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { brlToUsdc, lockRate } from "@/lib/fx";

// LAYOUT_UPDATE.md §7.2 — saque debita dentro da mesma transação que cria o
// Withdrawal, e só depois de checar saldo disponível. O pg_advisory_xact_lock
// serializa saques concorrentes do mesmo usuário: a segunda chamada espera a
// primeira confirmar (ou reverter) antes de ler o saldo, então "duas abas
// sacando o saldo inteiro ao mesmo tempo" não consegue sacar duas vezes —
// sem isso, duas leituras de saldo concorrentes veriam o mesmo valor "livre".
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { amountBrl } = body as { amountBrl?: number };

  if (!amountBrl || amountBrl <= 0) {
    return NextResponse.json({ error: "amountBrl (> 0) is required" }, { status: 400 });
  }
  if (!user.pixKey) {
    return NextResponse.json({ error: "Cadastre uma chave PIX antes de sacar" }, { status: 409 });
  }

  try {
    const withdrawal = await prisma.$transaction(async (tx) => {
      // Lock consistente por usuário — hashtext(userId) cabe em bigint.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, user.id);

      const agg = await tx.ledgerEntry.aggregate({
        where: { userId: user.id },
        _sum: { amountBrl: true },
      });
      const balance = Number(agg._sum.amountBrl ?? 0);

      if (amountBrl > balance) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const fxRate = await lockRate();
      const amountUsdc = await brlToUsdc(amountBrl);

      const w = await tx.withdrawal.create({
        data: {
          userId:    user.id,
          amount:    amountUsdc,
          amountBrl,
          fxRate,
          pixKey:    user.pixKey!,
          status:    "REQUESTED",
        },
      });

      await tx.ledgerEntry.create({
        data: {
          userId:       user.id,
          type:         "WITHDRAWAL",
          amountBrl:    -amountBrl,
          description:  `Saque via PIX — ${user.pixKey}`,
          withdrawalId: w.id,
        },
      });

      return w;
    });

    // Sem provedor de payout real ainda (mesmo estágio do PSP/KYC — mock).
    // Em produção isso dispara o pagamento e atualiza status para PAID/FAILED
    // via webhook do provedor.

    return NextResponse.json({ ok: true, withdrawalId: withdrawal.id, status: withdrawal.status });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 409 });
    }
    console.error("[withdraw] failed:", err);
    return NextResponse.json({ error: "Erro ao processar saque" }, { status: 500 });
  }
}
