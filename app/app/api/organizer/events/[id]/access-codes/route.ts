import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";
import { loadCapacityUsage, publicAvailability } from "@/lib/availability";
import { generateAccessCode } from "@/lib/accessCode";

const MAX_BATCH = 100;

// POST /api/organizer/events/[id]/access-codes — emite N códigos de entrada.
// PLANO_EVOLUCAO_V2.md §10.5-10.6/D41-D43. Transacional com lock por evento:
// é o único caminho que grava direito de entrada sem passar por contrato
// nenhum, então não pode ser o lado frouxo da conta de lotação — ao
// contrário do checkout (caminho quente, checagem otimista + rede de
// segurança do contrato revertendo no mint), aqui não existe rede embaixo.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id: eventId } = await params;

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== organizer.id) return forbidden();

  const body = await req.json().catch(() => ({}));
  const { count, label } = body as { count?: number; label?: string };

  if (!count || !Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
    return NextResponse.json({ error: `count must be an integer between 1 and ${MAX_BATCH}` }, { status: 400 });
  }

  try {
    const codes = await prisma.$transaction(async (tx) => {
      // Serializa contra outra emissão concorrente do mesmo evento — sem
      // isso, duas chamadas simultâneas poderiam ambas ler "5 vagas livres"
      // e juntas emitir mais códigos do que a capacidade permite.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, eventId);

      if (event.maxTickets !== null) {
        const usage = await loadCapacityUsage(eventId, event);
        const available = publicAvailability(event, usage);
        if (available !== null && count > available) {
          throw new Error(`NOT_ENOUGH_CAPACITY:${available}`);
        }
      }

      const created: { id: string; code: string; label: string | null; createdAt: Date }[] = [];
      for (let i = 0; i < count; i++) {
        // Colisão de `code` é ~impossível (10^15 espaço), mas em caso de
        // retry o unique constraint do banco protege — não silenciosamente.
        const code = generateAccessCode();
        const row = await tx.accessCode.create({
          data: { eventId, code, label: label || null, createdBy: user.id },
          select: { id: true, code: true, label: true, createdAt: true },
        });
        created.push(row);
      }
      return created;
    });

    return NextResponse.json({ codes }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("NOT_ENOUGH_CAPACITY:")) {
      const available = Number(message.split(":")[1]);
      return NextResponse.json(
        { error: `Only ${available} spot(s) available for this event`, available },
        { status: 409 }
      );
    }
    throw err;
  }
}

// GET /api/organizer/events/[id]/access-codes — lista, com o `code` em
// plaintext de propósito (§10.6/D43): o organizador precisa re-listar "qual
// código mandei pra quem" (label). O dano de vazamento é limitado — entrada
// única, revogável, vaga já contada.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id: eventId } = await params;

  const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
  if (!organizer) return forbidden();

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== organizer.id) return forbidden();

  const codes = await prisma.accessCode.findMany({
    where: { eventId },
    include: { entry: { select: { scannedAt: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      label: c.label,
      createdAt: c.createdAt,
      usedAt: c.usedAt,
      revokedAt: c.revokedAt,
      scannedAt: c.entry?.scannedAt ?? null,
    })),
  });
}
