"use client";

import { useEffect, useState } from "react";
import { Panel } from "./ui/Panel";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";

interface Round {
  roundNumber: number;
  author: "BUYER" | "SELLER";
  priceUsdc: number;
  createdAt: string;
}

interface NegotiationView {
  id: string;
  listingId: string;
  status: "OPEN" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "SUPERSEDED";
  turn: "BUYER" | "SELLER";
  roundCount: number;
  expiresAt: string;
  agreedPrice: number | null;
  eventTitle: string;
  tokenId: number;
  rounds: Round[];
}

const statusBadge: Record<NegotiationView["status"], { label: string; variant: "success" | "error" | "warning" | "neutral" }> = {
  OPEN: { label: "Em negociação", variant: "warning" },
  ACCEPTED: { label: "Aceita", variant: "success" },
  DECLINED: { label: "Recusada", variant: "error" },
  EXPIRED: { label: "Expirada", variant: "neutral" },
  SUPERSEDED: { label: "Perdida para outro comprador", variant: "neutral" },
};

// LAYOUT_UPDATE.md §6.5 — painel com as threads abertas de cada lado,
// histórico de rodadas e de quem é a vez.
export function NegotiationsPanel({
  getAccessToken,
  onChanged,
}: {
  getAccessToken: () => Promise<string | null>;
  onChanged: () => void;
}) {
  const [asBuyer, setAsBuyer] = useState<NegotiationView[]>([]);
  const [asSeller, setAsSeller] = useState<NegotiationView[]>([]);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const token = await getAccessToken();
    const r = await fetch("/api/negotiations", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const d = await r.json();
    setAsBuyer(d.asBuyer ?? []);
    setAsSeller(d.asSeller ?? []);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id: string, action: "accept" | "decline" | "counter", priceUsdc?: number) => {
    setBusy(id);
    setMsg(null);
    const token = await getAccessToken();
    const r = await fetch(`/api/negotiations/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: priceUsdc !== undefined ? JSON.stringify({ priceUsdc }) : undefined,
    });
    const d = await r.json();
    setBusy(null);
    if (!r.ok) { setMsg(d.error ?? "Erro"); return; }
    await load();
    onChanged();
  };

  const thread = (n: NegotiationView, myRole: "BUYER" | "SELLER") => {
    const lastRound = n.rounds[n.rounds.length - 1];
    const myTurn = n.status === "OPEN" && n.turn === myRole;
    return (
      <div key={n.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-text">{n.eventTitle} — token #{n.tokenId}</p>
          <Badge variant={statusBadge[n.status].variant}>{statusBadge[n.status].label}</Badge>
        </div>
        <div className="flex flex-col gap-1">
          {n.rounds.map((r) => (
            <p key={r.roundNumber} className="text-xs text-text-muted">
              {r.author === "BUYER" ? "Comprador" : "Vendedor"} ofereceu ${r.priceUsdc.toFixed(2)} USDC
            </p>
          ))}
        </div>
        {n.status === "OPEN" && (
          <p className="text-xs text-text-muted">
            {myTurn ? "Sua vez de responder" : "Aguardando a outra parte"} · expira {new Date(n.expiresAt).toLocaleString("pt-BR")}
          </p>
        )}
        {myTurn && lastRound && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="success" disabled={busy === n.id} onClick={() => act(n.id, "accept")}>
              Aceitar ${lastRound.priceUsdc.toFixed(2)}
            </Button>
            <Button size="sm" variant="danger" disabled={busy === n.id} onClick={() => act(n.id, "decline")}>
              Recusar
            </Button>
            {n.roundCount < 3 && (
              <>
                <Field
                  type="number"
                  step="0.01"
                  placeholder="Contraproposta USDC"
                  className="w-40"
                  value={counterInputs[n.id] ?? ""}
                  onChange={(e) => setCounterInputs((p) => ({ ...p, [n.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === n.id || !counterInputs[n.id]}
                  onClick={() => act(n.id, "counter", parseFloat(counterInputs[n.id]))}
                >
                  Contrapropor
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const openCount = [...asBuyer, ...asSeller].filter((n) => n.status === "OPEN").length;
  if (asBuyer.length === 0 && asSeller.length === 0) return null;

  return (
    <Panel title={`Minhas negociações${openCount > 0 ? ` (${openCount} pendente${openCount > 1 ? "s" : ""})` : ""}`} className="mb-8">
      {msg && <p className="mb-3 text-xs text-erro-on-dark">{msg}</p>}
      <div className="flex flex-col gap-6">
        {asSeller.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Propostas que recebi</p>
            <div className="flex flex-col gap-3">{asSeller.map((n) => thread(n, "SELLER"))}</div>
          </div>
        )}
        {asBuyer.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Propostas que fiz</p>
            <div className="flex flex-col gap-3">{asBuyer.map((n) => thread(n, "BUYER"))}</div>
          </div>
        )}
      </div>
    </Panel>
  );
}
