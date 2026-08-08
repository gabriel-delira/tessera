"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Icon as LeafletIcon } from "leaflet";
import { Modal } from "./Modal";
import { EventCard } from "./EventCard";
import { detectUserLocation, type LatLng } from "@/lib/geolocate";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const BboxWatcher = dynamic(() => import("./BboxWatcher"), { ssr: false });

// Sem localização (permissão negada ou IP não resolvido): centraliza no Brasil
// com zoom baixo em vez de não mostrar nada (PLANO_EVOLUCAO_V2.md §3.6).
const BRAZIL_CENTER: LatLng = { lat: -14.235, lng: -51.9253 };
const BRAZIL_ZOOM = 4;
const USER_ZOOM = 11;

interface NearbyEvent {
  id: string;
  title: string;
  venue: string;
  city: string;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  category: string;
  subcategory: string | null;
  eventDate: string;
  priceBrl: number;
  available: number | null;
  distanceKm: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  SHOW: "Show",
  FESTIVAL: "Festival",
  TEATRO: "Teatro",
  ESPORTE: "Esporte",
  CONFERENCIA: "Conferência",
  OUTRO: "Evento",
};

// unpkg pinado na mesma versão instalada — evita depender da resolução de
// assets estáticos do bundler pros ícones default do Leaflet.
function useMarkerIcon(): LeafletIcon | null {
  const [icon, setIcon] = useState<LeafletIcon | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled) return;
      setIcon(
        L.icon({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return icon;
}

export function EventsMapModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [center, setCenter] = useState<LatLng | null>(null);
  const [zoom, setZoom] = useState(BRAZIL_ZOOM);
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [status, setStatus] = useState<"locating" | "loading" | "ready">("locating");
  const markerIcon = useMarkerIcon();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // setState adiado pro próximo microtask — evita a cascata de renders de
    // chamar setState direto no corpo do efeito.
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setStatus("locating");
      setEvents([]);
      setCenter(null);

      const loc = await detectUserLocation();
      if (cancelled) return;
      if (loc) {
        setCenter(loc);
        setZoom(USER_ZOOM);
      } else {
        setCenter(BRAZIL_CENTER);
        setZoom(BRAZIL_ZOOM);
      }
      setStatus("loading");
    });

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [open]);

  const fetchByBbox = useCallback(async (bbox: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus((s) => (s === "locating" ? s : "loading"));
    try {
      const res = await fetch(`/api/events/nearby?bbox=${bbox}`, { signal: controller.signal });
      if (res.ok) {
        const d = await res.json();
        setEvents(d.events ?? []);
      }
    } catch {
      // AbortError esperado quando o usuário continua movendo o mapa
    } finally {
      if (!controller.signal.aborted) setStatus("ready");
    }
  }, []);

  return (
    <Modal open={open} onClose={onClose} title="Eventos no mapa" size="large">
      {status === "locating" && <p className="p-8 text-center text-text-muted">Localizando você…</p>}
      {center && (
        <div className="relative h-[70vh] w-full overflow-hidden rounded-lg">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={zoom}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <BboxWatcher onBboxChange={fetchByBbox} />
            {markerIcon &&
              events.map((e) => {
                const date = new Date(e.eventDate);
                const soldOut = e.available !== null && e.available <= 0;
                return (
                  <Marker key={e.id} position={[e.latitude, e.longitude]} icon={markerIcon}>
                    <Popup minWidth={256} maxWidth={280}>
                      <EventCard
                        compact
                        href={`/events/${e.id}`}
                        coverImageUrl={e.coverImageUrl}
                        day={date.toLocaleDateString("pt-BR", { day: "2-digit" })}
                        month={date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                        category={e.subcategory ? `${CATEGORY_LABEL[e.category]} · ${e.subcategory}` : CATEGORY_LABEL[e.category]}
                        title={e.title}
                        meta={`${e.venue} · ${e.city}`}
                        priceLabel="A partir de"
                        price={`R$ ${e.priceBrl.toFixed(2).replace(".", ",")}`}
                        cta={soldOut ? "Ver revenda" : "Comprar"}
                        ctaHref={soldOut ? `/revenda?tab=tickets&event=${e.id}` : undefined}
                      />
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>
          {status === "loading" && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-noite-900/50 text-text">
              Carregando eventos…
            </div>
          )}
          {status === "ready" && events.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
              <span className="rounded-md bg-noite-900/80 px-3 py-1.5 text-sm text-text">
                Nenhum evento nesta área do mapa.
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
