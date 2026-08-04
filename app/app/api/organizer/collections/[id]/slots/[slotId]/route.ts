import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const { id: collectionId, slotId } = await params;
  const slot = await prisma.slot.findUnique({ where: { id: slotId }, include: { collection: true } });
  if (!slot || slot.collectionId !== collectionId || slot.collection.organizerId !== organizer.id) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  await prisma.slot.delete({ where: { id: slotId } });
  return NextResponse.json({ ok: true });
}
