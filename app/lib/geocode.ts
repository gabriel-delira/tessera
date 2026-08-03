// Geocoding via Nominatim (OpenStreetMap) — mesmo provider dos tiles do mapa.
// Uso restrito à criação/edição de evento (nunca em runtime por request):
// a política de uso do Nominatim exige no máx. 1 req/s e um User-Agent identificável.
// https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "TesseraApp/1.0 (https://tessera.app; contato@tessera.app)";

export async function geocodeAddress(
  venue: string,
  city: string
): Promise<{ latitude: number; longitude: number } | null> {
  const query = `${venue}, ${city}, Brasil`;
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (results.length === 0) return null;
    return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
  } catch {
    // Falha de geocoding não pode bloquear a criação do evento — o mapa
    // simplesmente não mostra esse evento até alguém corrigir/regeocodificar.
    return null;
  }
}
