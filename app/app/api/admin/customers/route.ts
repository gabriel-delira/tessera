import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";

// Lista todo usuário que já comprou ou vendeu algo na plataforma (não só
// BUYER — um ORGANIZER também pode comprar ingresso de outro evento), pra dar
// ao admin um lugar único de verificação/moderação de clientes.
// PLANO — filtros: busca por email/nome/CPF/carteira e "só bloqueados".
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const onlyBlocked = searchParams.get("blocked") === "true";

  // Listing não tem relação com User (só `sellerAddress`) — resolve em duas
  // etapas: primeiro quem já vendeu algo, pra poder incluir esses usuários no
  // filtro de atividade abaixo mesmo que nunca tenham comprado.
  const soldWallets = (
    await prisma.listing.findMany({ where: { status: "SOLD" }, select: { sellerAddress: true }, distinct: ["sellerAddress"] })
  ).map((l) => l.sellerAddress);

  const users = await prisma.user.findMany({
    where: {
      blocked: onlyBlocked ? true : undefined,
      OR: q
        ? [
            { email: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { cpf: { contains: q } },
            { walletAddress: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
      // Só quem realmente comprou ou vendeu algo — evita listar contas
      // recém-criadas sem nenhuma transação concluída.
      AND: [{ OR: [{ purchases: { some: { status: "COMPLETED" } } }, { walletAddress: { in: soldWallets } }] }],
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      cpf: true,
      walletAddress: true,
      role: true,
      kycLevel: true,
      verified: true,
      blocked: true,
      blockedAt: true,
      blockedReason: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const userIds = users.map((u) => u.id);
  const wallets = users.map((u) => u.walletAddress).filter((w): w is string => !!w);

  const [purchaseAgg, salesAgg] = await Promise.all([
    prisma.purchase.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "COMPLETED" },
      _count: { _all: true },
      _sum: { amountBrl: true },
    }),
    prisma.listing.groupBy({
      by: ["sellerAddress"],
      where: { sellerAddress: { in: wallets }, status: "SOLD" },
      _count: { _all: true },
    }),
  ]);

  const purchaseByUser = new Map(purchaseAgg.map((p) => [p.userId, p]));
  const salesByWallet = new Map(salesAgg.map((s) => [s.sellerAddress, s]));

  const customers = users.map((u) => ({
    ...u,
    purchasesCompleted: purchaseByUser.get(u.id)?._count._all ?? 0,
    totalSpentBrl: Number(purchaseByUser.get(u.id)?._sum.amountBrl ?? 0),
    salesCompleted: (u.walletAddress && salesByWallet.get(u.walletAddress)?._count._all) ?? 0,
  }));

  return NextResponse.json({ customers });
}
