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

  await prisma.user.update({
    where: { id },
    data: { blocked: false, blockedAt: null, blockedReason: null },
  });

  return NextResponse.json({ ok: true });
}
