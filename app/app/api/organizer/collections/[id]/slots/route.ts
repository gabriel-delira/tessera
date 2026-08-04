import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";

// Adiciona um Event já existente do organizador como Slot da Collection —
// PLANO_EVOLUCAO_V2.md §6.2/D15. Um Event só pode estar em uma Collection
// (Slot.eventId é @unique no schema); a constraint de banco é quem
// garante isso, aqui só traduzimos a violação numa mensagem legível.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const { id: collectionId } = await params;
  const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
  if (!collection || collection.organizerId !== organizer.id) return forbidden();

  const body = await req.json().catch(() => ({}));
  const { eventId, label } = body as { eventId?: string; label?: string };
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.organizerId !== organizer.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const slot = await prisma.slot.create({
    data: { collectionId, eventId, label: label || null },
  }).catch((err: unknown) => {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") return null;
    throw err;
  });

  if (!slot) {
    return NextResponse.json({ error: "Este evento já pertence a outra coleção" }, { status: 409 });
  }

  return NextResponse.json({ slot: { ...slot, event } }, { status: 201 });
}
