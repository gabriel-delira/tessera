import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";

// Álbum de figurinhas — PLANO_EVOLUCAO_V2.md §6.2/D15. Collection é
// definida manualmente pelo organizador (decisão explícita: sem
// auto-detecção por título — heurística frágil demais pra confiar).
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const collections = await prisma.collection.findMany({
    where: { organizerId: organizer.id },
    include: {
      slots: {
        include: { event: { select: { id: true, title: true, eventDate: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ collections });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const body = await req.json().catch(() => ({}));
  const { title, description, coverImageUrl } = body as {
    title?: string;
    description?: string;
    coverImageUrl?: string;
  };

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const collection = await prisma.collection.create({
    data: {
      organizerId:   organizer.id,
      title:         title.trim(),
      description:   description || null,
      coverImageUrl: coverImageUrl || null,
    },
  });

  return NextResponse.json({ collection: { ...collection, slots: [] } }, { status: 201 });
}
