"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { EventsMapModal } from "./EventsMapModal";

export function MapTriggerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-border-strong px-4 text-[15px] font-semibold text-text hover:border-ouro-500"
      >
        <Icon name="mapa" />
        Ver no mapa
      </button>
      <EventsMapModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
