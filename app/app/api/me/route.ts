import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";

// LAYOUT_UPDATE.md §6.6 — badge de pendências no AppShell reaproveita esta
// chamada (que o AppShell já faz para o role) em vez de criar outra.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  await prisma.negotiation.updateMany({
    where: { status: "OPEN", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  let pendingNegotiations = 0;
  if (user.walletAddress) {
    const [asBuyer, asSeller] = await Promise.all([
      prisma.negotiation.count({ where: { buyerUserId: user.id, status: "OPEN", turn: "BUYER" } }),
      prisma.negotiation.count({ where: { status: "OPEN", turn: "SELLER", listing: { sellerAddress: user.walletAddress } } }),
    ]);
    pendingNegotiations = asBuyer + asSeller;
  } else {
    pendingNegotiations = await prisma.negotiation.count({ where: { buyerUserId: user.id, status: "OPEN", turn: "BUYER" } });
  }

  return NextResponse.json({ role: user.role, pendingNegotiations });
}
