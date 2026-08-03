import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

export const MAX_ROUNDS = 3;
export const ROUND_TTL_MS = 24 * 60 * 60 * 1000;

export type NegotiationRole = "BUYER" | "SELLER";

interface ResolveResult {
  error?: { message: string; status: number };
  negotiation?: Awaited<ReturnType<typeof loadNegotiation>>;
  role?: NegotiationRole;
}

async function loadNegotiation(id: string) {
  return prisma.negotiation.findUnique({
    where: { id },
    include: {
      listing: { include: { ticket: { include: { event: true } } } },
      rounds: { orderBy: { roundNumber: "desc" }, take: 1 },
    },
  });
}

// Resolve o papel do usuário na negociação, expira preguiçosamente a rodada
// vencida (§6.2) e garante que a ação só é aceita de quem tem a vez.
export async function resolveNegotiationAction(
  negotiationId: string,
  user: User,
  requireMyTurn: boolean
): Promise<ResolveResult> {
  let negotiation = await loadNegotiation(negotiationId);
  if (!negotiation) return { error: { message: "Negotiation not found", status: 404 } };

  if (negotiation.status === "OPEN" && negotiation.expiresAt.getTime() < Date.now()) {
    await prisma.negotiation.update({ where: { id: negotiationId }, data: { status: "EXPIRED" } });
    negotiation = await loadNegotiation(negotiationId);
  }

  if (!negotiation || negotiation.status !== "OPEN") {
    return { error: { message: "Negotiation is not open", status: 409 } };
  }

  const isBuyer  = negotiation.buyerUserId === user.id;
  const isSeller = !!user.walletAddress && negotiation.listing.sellerAddress.toLowerCase() === user.walletAddress.toLowerCase();
  if (!isBuyer && !isSeller) return { error: { message: "Forbidden", status: 403 } };

  const role: NegotiationRole = isBuyer ? "BUYER" : "SELLER";
  if (requireMyTurn && negotiation.turn !== role) {
    return { error: { message: "Not your turn", status: 409 } };
  }

  return { negotiation, role };
}
