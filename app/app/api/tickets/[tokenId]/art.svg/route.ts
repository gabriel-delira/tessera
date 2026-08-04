import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateTicketArtSvg } from "@/lib/ticketArt";

// PLANO_EVOLUCAO_V2.md §6.1/D13 — arte gerada, servida como imagem de
// verdade (não JSON) pra poder ser usada tanto no metadata do NFT quanto
// direto num <img>/background-image do álbum. Pública e sem auth: é o
// mesmo dado que já está em tokenURI, que qualquer indexador lê.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: tokenIdStr } = await params;
  const tokenId = parseInt(tokenIdStr, 10);
  if (isNaN(tokenId)) return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });

  const ticket = await prisma.ticket.findUnique({
    where: { tokenId },
    include: {
      checkin: true,
      event: { select: { title: true, city: true, eventDate: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: "Token not found" }, { status: 404 });

  const svg = generateTicketArtSvg({
    tokenId,
    eventTitle: ticket.event.title,
    ticketNumber: ticket.ticketNumber,
    city: ticket.event.city,
    eventDateIso: ticket.event.eventDate.toISOString(),
    attended: ticket.checkin !== null,
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
