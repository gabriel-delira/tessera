export interface LatLng {
  lat: number;
  lng: number;
}

function getBrowserLocation(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 }
    );
  });
}

async function getIpLocation(): Promise<LatLng | null> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d.latitude !== "number" || typeof d.longitude !== "number") return null;
    return { lat: d.latitude, lng: d.longitude };
  } catch {
    return null;
  }
}

// Tenta a localização do navegador primeiro (mais precisa); se o usuário
// negar a permissão ou o browser não suportar, cai pro IP (menos preciso,
// mas não bloqueia a navegação).
export async function detectUserLocation(): Promise<LatLng | null> {
  const browser = await getBrowserLocation();
  if (browser) return browser;
  return getIpLocation();
}
