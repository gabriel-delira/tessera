"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useMapEvents } from "react-leaflet";

const BBOX_DEBOUNCE_MS = 400;

// Próprio arquivo pra poder ser carregado via next/dynamic({ ssr:false }) —
// "react-leaflet" toca `window` na importação e quebra o SSR do componente
// pai se for importado no topo do módulo (mesmo motivo do dynamic() nos
// outros componentes do Leaflet em EventsMapModal.tsx).
export default function BboxWatcher({ onBboxChange }: { onBboxChange: (bbox: string) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emit = useCallback(
    (map: LeafletMap) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        onBboxChange(map.getBounds().toBBoxString());
      }, BBOX_DEBOUNCE_MS);
    },
    [onBboxChange]
  );

  const map = useMapEvents({
    moveend: () => emit(map),
    zoomend: () => emit(map),
  });

  useEffect(() => {
    emit(map);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
