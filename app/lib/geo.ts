// Compartilhado entre /api/events/nearby (raio, usado pelo filtro "perto de
// você" e pelo modal de mapa) e a ordenação por distância da home. Extraído
// daqui para não duplicar a fórmula em três lugares (PLANO_EVOLUCAO_V2.md §3.2).
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

// Parser de "minLng,minLat,maxLng,maxLat" — mesma ordem que Leaflet expõe em
// map.getBounds().toBBoxString(), pra não ter que reordenar no cliente.
export function parseBboxParam(raw: string | null): BoundingBox | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  return { minLat, minLng, maxLat, maxLng };
}
