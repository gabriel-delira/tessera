"use client";

import { useState } from "react";
import { useAuth, type Persona } from "./AuthProvider";

// DEV ONLY — some sozinho quando /api/dev/persona responde 404, o que é o caso
// sempre que APP_ENV !== "local". Deliberadamente berrante: se este controle
// aparecer num ambiente que não seja a sua máquina, é para ser impossível não
// notar.

function describe(p: Persona): string {
  const parts: string[] = [p.role];
  if (p.role === "BUYER") {
    parts.push(p.ticketCount > 0 ? `${p.ticketCount} ingressos` : "sem ingressos");
  }
  if (p.kycLevel && p.kycLevel !== "NONE") parts.push(`KYC ${p.kycLevel}`);
  return parts.join(" · ");
}

export function DevPersonaSwitcher() {
  const { devEnabled, personas, persona, assumePersona, releasePersona } = useAuth();
  const [open, setOpen] = useState(false);

  if (!devEnabled) return null;

  const label = persona
    ? (persona.displayName ?? persona.email ?? persona.privyId)
    : "Escolher persona";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Login local de desenvolvimento — não existe em produção"
        className="flex h-11 items-center gap-2 rounded-md border border-dashed border-amber-400/70 bg-amber-400/10 px-3 text-[13px] font-semibold text-amber-300 hover:bg-amber-400/20"
      >
        <span className="rounded bg-amber-400/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
          dev
        </span>
        {label}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-amber-400/40 bg-noite-800 shadow-xl">
          <p className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-amber-300/80">
            Personas do seed
          </p>

          <ul className="max-h-80 overflow-y-auto">
            {personas.map((p) => {
              const active = p.privyId === persona?.privyId;
              return (
                <li key={p.privyId}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      void assumePersona(p.privyId);
                    }}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-white/5 ${
                      active ? "bg-white/5" : ""
                    }`}
                  >
                    <span className="text-sm font-medium text-text">
                      {p.displayName ?? p.email ?? p.privyId}
                      {active && <span className="ml-2 text-amber-300">•</span>}
                    </span>
                    <span className="text-[11px] text-text-muted">{describe(p)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {persona && (
            <button
              onClick={() => {
                setOpen(false);
                void releasePersona();
              }}
              className="w-full border-t border-border px-3 py-2.5 text-left text-sm text-text-muted hover:bg-white/5 hover:text-text"
            >
              Sair da persona
            </button>
          )}
        </div>
      )}
    </div>
  );
}
