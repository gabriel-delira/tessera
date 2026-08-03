"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { detectUserLocation } from "@/lib/geolocate";

const CATEGORY_CHIPS = [
  { value: "", label: "Todos" },
  { value: "SHOW", label: "Show" },
  { value: "FESTIVAL", label: "Festival" },
  { value: "TEATRO", label: "Teatro" },
  { value: "ESPORTE", label: "Esporte" },
  { value: "CONFERENCIA", label: "Conferência" },
];

const SORT_OPTIONS = [
  { value: "date", label: "Próximos eventos" },
  { value: "az", label: "Ordem alfabética (A-Z)" },
  { value: "za", label: "Ordem alfabética (Z-A)" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
];

export function EventFilters({ cities }: { cities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cat     = searchParams.get("cat") ?? "";
  const city    = searchParams.get("city") ?? "";
  const from    = searchParams.get("from") ?? "";
  const to      = searchParams.get("to") ?? "";
  const sort    = searchParams.get("sort") ?? "date";
  const near    = searchParams.get("near") ?? "";
  const showAll = searchParams.get("showAll") === "1";

  const [dateError, setDateError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const handleDateChange = (key: "from" | "to", value: string) => {
    const nextFrom = key === "from" ? value : from;
    const nextTo   = key === "to" ? value : to;
    if (nextFrom && nextTo && nextFrom > nextTo) {
      setDateError("A data inicial não pode ser depois da data final.");
      return;
    }
    setDateError(null);
    setParam(key, value);
  };

  const toggleNear = async () => {
    if (near) {
      setParam("near", "");
      return;
    }
    setLocationError(null);
    setLocating(true);
    const loc = await detectUserLocation();
    setLocating(false);
    if (!loc) {
      setLocationError("Não conseguimos localizar você. Verifique a permissão de localização.");
      return;
    }
    setParam("near", `${loc.lat},${loc.lng}`);
  };

  return (
    <div className="mb-8 flex flex-col gap-4">
      {/* Categoria — barra de chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setParam("cat", c.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              cat === c.value
                ? "bg-laranja-500 text-noite-800"
                : "border border-border-strong text-text-muted hover:bg-white/5"
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          onClick={toggleNear}
          disabled={locating}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            near
              ? "bg-laranja-500 text-noite-800"
              : "border border-border-strong text-text-muted hover:bg-white/5"
          }`}
        >
          {locating ? "Localizando…" : near ? "✓ Perto de você" : "Perto de você"}
        </button>
      </div>
      {locationError && <p className="text-xs text-erro-on-dark">{locationError}</p>}

      <div className="flex flex-wrap items-end gap-3">
        {/* Localidade */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Localidade</span>
          <select
            value={city}
            onChange={(e) => setParam("city", e.target.value)}
            className="h-11 rounded-md border border-border bg-surface-2 px-4 text-[15px] text-text focus:border-ouro-400 focus:outline-none"
          >
            <option value="">Todas as cidades</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        {/* Ordenação */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Ordenar por</span>
          <select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value === "date" ? "" : e.target.value)}
            className="h-11 rounded-md border border-border bg-surface-2 px-4 text-[15px] text-text focus:border-ouro-400 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        {/* Calendário — data única ou intervalo */}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">De</span>
          <input
            type="date"
            value={from}
            onChange={(e) => handleDateChange("from", e.target.value)}
            className="h-11 rounded-md border border-border bg-surface-2 px-4 text-[15px] text-text focus:border-ouro-400 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => handleDateChange("to", e.target.value)}
            className="h-11 rounded-md border border-border bg-surface-2 px-4 text-[15px] text-text focus:border-ouro-400 focus:outline-none"
          />
        </label>

        {(cat || city || from || to || sort !== "date" || near) && (
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="h-11 rounded-md border border-border-strong px-4 text-sm font-medium text-text-muted hover:bg-white/5"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => setParam("showAll", e.target.checked ? "1" : "")}
          className="h-4 w-4 rounded border-border-strong accent-ouro-500"
        />
        Mostrar eventos pausados e esgotados
      </label>

      {dateError && <p className="text-xs text-erro-on-dark">{dateError}</p>}
    </div>
  );
}
