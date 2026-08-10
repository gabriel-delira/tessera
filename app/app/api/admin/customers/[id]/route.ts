import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAuthUser(req);
  if (!admin) return unauthorized();
  if (admin.role !== "ADMIN") return forbidden();

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [purchases, listings, checkins] = await Promise.all([
    prisma.purchase.findMany({
      where: { userId: id },
      include: { event: { select: { title: true } }, recipient: { select: { email: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    target.walletAddress
      ? prisma.listing.findMany({
          where: { sellerAddress: target.walletAddress },
          include: { ticket: { include: { event: { select: { title: true } } } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    prisma.checkin.findMany({
      where: { ticket: { ownerAddress: target.walletAddress ?? "__none__" } },
      include: { ticket: { include: { event: { select: { title: true } } } } },
      orderBy: { scannedAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    user: target,
    purchases: purchases.map((p) => ({
      id: p.id,
      eventTitle: p.event.title,
      amountBrl: Number(p.amountBrl),
      amountUsdc: Number(p.amountUsdc),
      status: p.status,
      paymentMethod: p.paymentMethod,
      isGift: !!p.recipientUserId && p.recipientUserId !== p.userId,
      recipient: p.recipient ? (p.recipient.displayName ?? p.recipient.email) : null,
      createdAt: p.createdAt,
    })),
    sales: listings.map((l) => ({
      id: l.id,
      tokenId: l.tokenId,
      eventTitle: l.ticket.event.title,
      priceUsdc: Number(l.price),
      status: l.status,
      createdAt: l.createdAt,
    })),
    checkins: checkins.map((c) => ({
      id: c.id,
      eventTitle: c.ticket.event.title,
      tokenId: c.tokenId,
      scannedAt: c.scannedAt,
    })),
  });
}
