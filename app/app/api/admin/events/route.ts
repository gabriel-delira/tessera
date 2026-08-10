import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden();

  const { searchParams } = new URL(req.url);
  const EVENT_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ON_SALE", "PAUSED", "ENDED", "FROZEN", "REJECTED"] as const;
  type EventStatusValue = typeof EVENT_STATUSES[number];
  const rawStatus = searchParams.get("status") ?? "PENDING_APPROVAL";
  if (!EVENT_STATUSES.includes(rawStatus as EventStatusValue)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const status = rawStatus as EventStatusValue;

  const events = await prisma.event.findMany({
    where:   { status },
    include: {
      organizer: { select: { companyName: true, document: true } },
      // Matriz de ingressos (dias × área × lote) + quantos já foram mintados
      // por tipo — pra admin ver a composição real da oferta, não só o preço
      // "de vitrine" do evento (Event.ticketPriceUsdc).
      // Sem ordenação por dia: `dayIds` é uma lista, e ordenar por ela no SQL
      // não tem significado — a tela ordena pela ordem dos dias do evento.
      ticketTypes: {
        orderBy: [{ areaId: "asc" }, { lotNumber: "asc" }],
        include: { _count: { select: { tickets: true } } },
      },
      // Só os campos usados pra contar (não o `code` em si — segredo ao
      // portador, sem motivo de sair desta tela).
      accessCodes: { select: { usedAt: true, revokedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    events: events.map(({ accessCodes, ...e }) => ({
      ...e,
      accessCodesTotal:   accessCodes.length,
      accessCodesUsed:    accessCodes.filter((c) => c.usedAt !== null).length,
      accessCodesRevoked: accessCodes.filter((c) => c.revokedAt !== null).length,
    })),
  });
}
