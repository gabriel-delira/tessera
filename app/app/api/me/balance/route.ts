import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";

// LAYOUT_UPDATE.md §7 — saldo é sempre SUM(amountBrl) do ledger, nunca um
// campo denormalizado lido de outro lugar.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const [agg, entries] = await Promise.all([
    prisma.ledgerEntry.aggregate({ where: { userId: user.id }, _sum: { amountBrl: true } }),
    prisma.ledgerEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    balanceBrl: Number(agg._sum.amountBrl ?? 0),
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      amountBrl: Number(e.amountBrl),
      description: e.description,
      onchainTxHash: e.onchainTxHash,
      createdAt: e.createdAt,
    })),
  });
}
