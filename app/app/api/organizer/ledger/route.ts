import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";
import { getSettledSplitFromTx } from "@/lib/onchain";

// LAYOUT_UPDATE.md §5.7.2 — extrato do organizador: a interface do atestado,
// não o atestado em si. Cada linha é conferida contra o evento TicketSettled
// da própria transação — se alguém adulterasse o valor no banco, a
// comparação com a cadeia haveria de acusar divergência.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const entries = await prisma.ledgerEntry.findMany({
    where: { userId: user.id, type: "ROYALTY_PAYOUT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { purchase: { select: { fxRate: true, event: { select: { title: true } } } } },
  });

  const rows = await Promise.all(
    entries.map(async (e) => {
      let onchainVerified: boolean | null = null;
      let onchainRoyaltyBrl: number | null = null;

      if (e.onchainTxHash && e.purchase) {
        try {
          const split = await getSettledSplitFromTx(e.onchainTxHash as `0x${string}`);
          if (split) {
            onchainRoyaltyBrl = Math.round(split.royaltyAmount * Number(e.purchase.fxRate) * 100) / 100;
            // Tolerância de 1 centavo para arredondamento entre as duas contas.
            onchainVerified = Math.abs(onchainRoyaltyBrl - Number(e.amountBrl)) <= 0.01;
          } else {
            onchainVerified = false;
          }
        } catch (err) {
          console.error("[organizer/ledger] failed to verify tx:", e.onchainTxHash, err);
          onchainVerified = null; // rede indisponível — não afirma nem nega
        }
      }

      return {
        id: e.id,
        amountBrl: Number(e.amountBrl),
        description: e.description,
        eventTitle: e.purchase?.event.title ?? null,
        onchainTxHash: e.onchainTxHash,
        onchainVerified,
        onchainRoyaltyBrl,
        createdAt: e.createdAt,
      };
    })
  );

  return NextResponse.json({ entries: rows });
}
