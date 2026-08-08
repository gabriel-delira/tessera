import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";

// DELETE /api/organizer/events/[id]/access-codes/[codeId] — revoga um código
// não usado. PLANO_EVOLUCAO_V2.md §10.5/D41-D43. Código já queimado (usedAt
// preenchido) é registro de quem entrou — não pode sumir, por isso 409 em
// vez de revogar silenciosamente. A vaga volta pra `codesPending` no mesmo
// instante (lib/availability.ts conta só `usedAt: null, revokedAt: null`).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; codeId: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id: eventId, codeId } = await params;

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== organizer.id) return forbidden();

  const code = await prisma.accessCode.findUnique({ where: { id: codeId } });
  if (!code || code.eventId !== eventId) {
    return NextResponse.json({ error: "Access code not found" }, { status: 404 });
  }
  if (code.usedAt !== null) {
    return NextResponse.json({ error: "Cannot revoke a code that was already used" }, { status: 409 });
  }
  if (code.revokedAt !== null) {
    return NextResponse.json({ ok: true }); // já revogado — idempotente
  }

  await prisma.accessCode.update({ where: { id: codeId }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
