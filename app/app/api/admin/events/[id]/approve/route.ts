import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized, forbidden } from "@/lib/auth";
import { createEventOnChain, type TicketTypeInput } from "@/lib/onchain";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden();

  const { id } = await params;

  const event = await prisma.event.findUnique({
    where:   { id },
    include: {
      organizer: true,
      // PLANO_EVOLUCAO_V2.md §5.1/§5.2 — ordem estável: é o índice desta lista
      // que casa com o índice do array `types` mandado ao contrato, e é essa
      // mesma ordem que usamos pra ligar de volta o `typeId` retornado.
      ticketTypes: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "Event is not pending approval" }, { status: 409 });
  }
  if (event.organizer.blocked) {
    return NextResponse.json({ error: "Organizador bloqueado" }, { status: 409 });
  }
  if (event.ticketTypes.length === 0) {
    return NextResponse.json({ error: "Event has no ticket types" }, { status: 409 });
  }

  // Mark APPROVED while we wait for chain
  await prisma.event.update({ where: { id }, data: { status: "APPROVED" } });

  const types: TicketTypeInput[] = event.ticketTypes.map((t) => ({
    priceUsdc:  Number(t.priceUsdc),
    maxTickets: t.quantity,
    salesEndAt: t.salesEndAt,
    label:      t.label,
  }));

  let result;
  try {
    result = await createEventOnChain(event, types);
  } catch (err) {
    // Roll back to PENDING_APPROVAL so admin can retry
    await prisma.event.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
    console.error("[admin/approve] createEvent on-chain failed:", err);
    return NextResponse.json({ error: "On-chain createEvent failed", detail: String(err) }, { status: 500 });
  }

  if (result.ticketTypeIds.length !== event.ticketTypes.length) {
    // Não deveria acontecer — o contrato emite um TicketTypeAdded por tipo enviado.
    // Se acontecer, o evento já está ON_SALE on-chain; travar aqui sem persistir
    // os onchainTypeId deixaria a compra sem saber qual tipo comprar. Melhor
    // logar alto e seguir com o que veio do que reverter um createEvent que já
    // foi minerado.
    console.error(
      "[admin/approve] ticketTypeIds count mismatch",
      { expected: event.ticketTypes.length, got: result.ticketTypeIds.length }
    );
  }

  await prisma.$transaction([
    prisma.event.update({
      where: { id },
      data: {
        status:              "ON_SALE",
        onchainEventId:      result.onchainEventId,
        royaltySplitterAddr: result.royaltySplitterAddr,
        createTxHash:        result.txHash,
      },
    }),
    ...event.ticketTypes.map((t, i) =>
      prisma.ticketType.update({
        where: { id: t.id },
        data:  { onchainTypeId: result.ticketTypeIds[i] ?? null },
      })
    ),
  ]);

  return NextResponse.json({
    ok: true,
    onchainEventId:      result.onchainEventId,
    royaltySplitterAddr: result.royaltySplitterAddr,
    txHash:              result.txHash,
  });
}
