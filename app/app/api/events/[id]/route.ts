import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { usdcToBrl } from "@/lib/fx";
import { loadCapacityUsage, publicAvailability } from "@/lib/availability";
import { listGroups, resolveActiveTicketType, groupDayNames, isPass, daySetKey } from "@/lib/ticketMatrix";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      organizer: { select: { companyName: true, payoutWallet: true } },
      ticketTypes: true,
    },
  });

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const usage        = await loadCapacityUsage(id, event);
  const available     = publicAvailability(event, usage);
  const priceUsdc    = Number(event.ticketPriceUsdc);
  const priceBrl     = await usdcToBrl(priceUsdc);

  // Matriz de ingressos — 2026-08-08, com passes multi-dia. Uma entrada por
  // (conjunto de dias, área) com o lote ATIVO daquela combinação (nunca
  // escolhido pelo comprador — lib/ticketMatrix.ts resolve por cota/data).
  // `dayIds` vazio quando o evento não usa a dimensão de dia; mais de um
  // elemento = passe. A página só mostra seletor se houver mais de 1 grupo.
  const days  = (event.ticketDays as { id: string; name: string }[] | null) ?? [];
  const areas = (event.ticketAreas as { id: string; name: string }[] | null) ?? [];
  const groups = listGroups(event.ticketTypes);
  const ticketGroups = await Promise.all(
    groups.map(async ({ dayIds, areaId }) => {
      const active = await resolveActiveTicketType(id, dayIds, areaId, event.ticketTypes);
      const activeUsdc = active ? Number(active.priceUsdc) : null;
      const dayNames = groupDayNames(dayIds, days);
      const pass = isPass(dayIds);
      return {
        // Chave estável do grupo — é o que o comprador manda de volta no
        // checkout, em vez de reconstruir o conjunto de dias no cliente.
        key: `${daySetKey(dayIds)}::${areaId ?? ""}`,
        dayIds,
        areaId,
        dayNames,
        isPass:   pass,
        // Passe usa o rótulo escrito pelo organizador ("Passe 3 dias",
        // "Ultra"); listar "Dia 1, Dia 2, Dia 3" no seletor seria pior.
        // Ingresso de um dia usa o nome do dia.
        label:    pass ? (active?.label ?? dayNames.join(", ")) : (dayNames[0] ?? null),
        areaName: areas.find((a) => a.id === areaId)?.name ?? null,
        soldOut:  active === null,
        priceUsdc: activeUsdc,
        priceBrl:  activeUsdc !== null ? await usdcToBrl(activeUsdc) : null,
        earlyEntryMinutes: active?.earlyEntryMinutes ?? null,
      };
    })
  );

  return NextResponse.json({
    id:            event.id,
    title:         event.title,
    description:   event.description,
    venue:         event.venue,
    city:          event.city,
    coverImageUrl: event.coverImageUrl,
    eventDate:     event.eventDate,
    endDate:       event.endDate,
    doorsOpenAt:   event.doorsOpenAt,
    ticketDays:    days,
    ticketPriceUsdc: priceUsdc,
    ticketPriceBrl:  priceBrl,
    platformFeeBps:  event.platformFeeBps,
    royaltyBps:      event.royaltyBps,
    maxTickets:      event.maxTickets,
    maxTicketsPerAccount: event.maxTicketsPerAccount,
    soldCount:     usage.sold,
    available,
    status:          event.status,
    onchainEventId:  event.onchainEventId,
    organizer:       event.organizer.companyName,
    ticketGroups,
  });
}
