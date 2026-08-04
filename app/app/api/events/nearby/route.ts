import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { usdcToBrl } from "@/lib/fx";
import { distanceKm, parseBboxParam } from "@/lib/geo";
import { publicAvailability } from "@/lib/availability";
import type { Prisma } from "@prisma/client";

// Dois modos, mutuamente exclusivos:
// - lat+lng+radiusKm: usado pelo filtro "perto de você" — ordena por distância
//   a partir de um ponto, dataset pequeno o suficiente pra filtrar em memória.
// - bbox: usado pelo modal de mapa — filtra pelo retângulo visível no Leaflet
//   (map.getBounds()), refetch em moveend/zoomend (PLANO_EVOLUCAO_V2.md §3.6).
//   Filtrado direto no Prisma por ser mais barato que haversine para "o que
//   está na tela".
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bbox = parseBboxParam(searchParams.get("bbox"));
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radiusKm = parseFloat(searchParams.get("radiusKm") ?? "300");

  if (!bbox && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    return NextResponse.json({ error: "either bbox or lat+lng is required" }, { status: 400 });
  }

  const where: Prisma.EventWhereInput = {
    status: { in: ["ON_SALE", "PAUSED"] },
    latitude: { not: null },
    longitude: { not: null },
  };
  if (bbox) {
    where.latitude = { gte: bbox.minLat, lte: bbox.maxLat };
    where.longitude = { gte: bbox.minLng, lte: bbox.maxLng };
  }

  const events = await prisma.event.findMany({
    where,
    include: { _count: { select: { tickets: true } } },
    orderBy: { eventDate: "asc" },
    take: bbox ? 500 : undefined,
  });

  const centerLat = bbox ? (bbox.minLat + bbox.maxLat) / 2 : lat;
  const centerLng = bbox ? (bbox.minLng + bbox.maxLng) / 2 : lng;

  let withDistance = events.map((e) => ({
    ...e,
    distanceKm: distanceKm(centerLat, centerLng, e.latitude!, e.longitude!),
  }));

  if (!bbox) {
    withDistance = withDistance
      .filter((e) => e.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 200);
  }

  const withPrice = await Promise.all(
    withDistance.map(async (e) => ({
      id: e.id,
      title: e.title,
      venue: e.venue,
      city: e.city,
      latitude: e.latitude,
      longitude: e.longitude,
      coverImageUrl: e.coverImageUrl,
      category: e.category,
      subcategory: e.subcategory,
      eventDate: e.eventDate,
      priceBrl: await usdcToBrl(Number(e.ticketPriceUsdc)),
      available: publicAvailability(e, e._count.tickets),
      distanceKm: Math.round(e.distanceKm * 10) / 10,
    }))
  );

  return NextResponse.json({ events: withPrice });
}
