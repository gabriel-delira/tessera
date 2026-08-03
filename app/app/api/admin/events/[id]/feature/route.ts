import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";

// LAYOUT_UPDATE.md §4.1 — pin do admin no carrossel de destaques.
// POST com { rank: number } fixa a posição; { rank: "auto" } fixa no fim da fila
// (maior rank em uso + 1); POST sem rank (ou rank null) limpa o pin.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden();

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { rank } = body as { rank?: number | "auto" | null };

  let featuredRank: number | null = null;
  if (rank === "auto") {
    const last = await prisma.event.findFirst({
      where: { featuredRank: { not: null }, id: { not: id } },
      orderBy: { featuredRank: "desc" },
      select: { featuredRank: true },
    });
    featuredRank = (last?.featuredRank ?? 0) + 1;
  } else if (rank !== undefined && rank !== null) {
    const n = Number(rank);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: "rank must be a positive integer" }, { status: 400 });
    }
    featuredRank = n;
  }

  const updated = await prisma.event.update({ where: { id }, data: { featuredRank } });
  return NextResponse.json({ ok: true, featuredRank: updated.featuredRank });
}
