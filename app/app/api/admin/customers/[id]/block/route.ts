import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAuthUser(req);
  if (!admin) return unauthorized();
  if (admin.role !== "ADMIN") return forbidden();

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "Não é possível bloquear outro admin" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const reason: string | null = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  await prisma.user.update({
    where: { id },
    data: { blocked: true, blockedAt: new Date(), blockedReason: reason },
  });

  return NextResponse.json({ ok: true });
}
