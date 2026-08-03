import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { resolveNegotiationAction } from "@/lib/negotiations";
import { mail } from "@/lib/mail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const { error, negotiation, role } = await resolveNegotiationAction(id, user, true);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  await prisma.negotiation.update({ where: { id }, data: { status: "DECLINED" } });

  const listing = negotiation!.listing;
  const counterpartyUser = role === "BUYER"
    ? await prisma.user.findFirst({ where: { walletAddress: listing.sellerAddress } })
    : await prisma.user.findUnique({ where: { id: negotiation!.buyerUserId } });
  if (counterpartyUser?.email) {
    await mail.send({
      to: counterpartyUser.email,
      subject: "Sua proposta foi recusada",
      body: `A negociação pelo ingresso de "${listing.ticket.event.title}" foi encerrada sem acordo.`,
    });
  }

  return NextResponse.json({ ok: true });
}
