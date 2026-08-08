import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (!user.walletAddress) return NextResponse.json([]);

  const tickets = await prisma.ticket.findMany({
    where: { ownerAddress: user.walletAddress },
    include: {
      checkin: { select: { id: true } }, // presença — "Você esteve lá" (§5.3/§8)
      event: {
        select: {
          id: true,
          title: true,
          venue: true,
          city: true,
          eventDate: true,
          endDate: true, // "já aconteceu" — PLANO_EVOLUCAO_V2.md §10.1/D35
          coverImageUrl: true,
        },
      },
    },
    orderBy: { mintedAt: "desc" },
  });

  return NextResponse.json(
    tickets.map((t) => ({ ...t, attended: t.checkin !== null }))
  );
}
