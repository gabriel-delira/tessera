import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, unauthorized } from "@/lib/auth";

// Álbum de figurinhas do usuário — PLANO_EVOLUCAO_V2.md §6.2/D15. Só mostra
// coleções em que o usuário já preenche pelo menos um slot (não faz sentido
// exibir uma série inteira de coleção alheia). "Preenchido" = tem hoje um
// Ticket pro Event daquele slot; slot vazio ganha o link pra Revenda quando
// existe um anúncio ativo pro mesmo evento.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!user.walletAddress) return NextResponse.json({ collections: [] });

  const ownedTickets = await prisma.ticket.findMany({
    where: { ownerAddress: user.walletAddress },
    select: { eventId: true, tokenId: true },
  });
  if (ownedTickets.length === 0) return NextResponse.json({ collections: [] });

  const tokenIdByEvent = new Map(ownedTickets.map((t) => [t.eventId, t.tokenId]));
  const ownedEventIds = [...tokenIdByEvent.keys()];

  const collections = await prisma.collection.findMany({
    where: { slots: { some: { eventId: { in: ownedEventIds } } } },
    include: {
      slots: {
        include: {
          event: { select: { id: true, title: true, eventDate: true, city: true, coverImageUrl: true } },
        },
        orderBy: { event: { eventDate: "asc" } },
      },
    },
  });

  const unfilledEventIds = collections
    .flatMap((c) => c.slots)
    .map((s) => s.eventId)
    .filter((eventId) => !tokenIdByEvent.has(eventId));

  const listings = unfilledEventIds.length
    ? await prisma.listing.findMany({
        where: { status: "ACTIVE", onchainListingId: { not: null }, ticket: { eventId: { in: unfilledEventIds } } },
        select: { id: true, ticket: { select: { eventId: true } } },
      })
    : [];
  const listingByEvent = new Map<string, string>();
  for (const l of listings) {
    if (!listingByEvent.has(l.ticket.eventId)) listingByEvent.set(l.ticket.eventId, l.id);
  }

  const result = collections.map((c) => ({
    id:            c.id,
    title:         c.title,
    coverImageUrl: c.coverImageUrl,
    slots: c.slots.map((s) => {
      const tokenId = tokenIdByEvent.get(s.eventId) ?? null;
      return {
        slotId:        s.id,
        eventId:       s.eventId,
        label:         s.label ?? s.event.title,
        eventTitle:    s.event.title,
        eventDate:     s.event.eventDate,
        city:          s.event.city,
        coverImageUrl: s.event.coverImageUrl,
        filled:        tokenId !== null,
        tokenId,
        listingId:     tokenId === null ? listingByEvent.get(s.eventId) ?? null : null,
      };
    }),
  }));

  return NextResponse.json({ collections: result });
}
