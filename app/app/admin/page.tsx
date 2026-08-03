"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import { PageTitle } from "../components/ui/PageTitle";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Field } from "../components/ui/Field";

type Tab = "organizers" | "events" | "featured";

interface PendingOrganizer {
  id: string;
  companyName: string;
  document: string;
  payoutWallet: string;
  status: string;
  user: { email: string | null };
}

interface PendingEvent {
  id: string;
  title: string;
  city: string;
  eventDate: string;
  ticketPriceUsdc: number;
  maxTickets: number | null;
  status: string;
  organizer: { companyName: string };
}

interface ActiveEvent {
  id: string;
  title: string;
  city: string;
  eventDate: string;
  status: string;
  featuredRank: number | null;
  organizer: { companyName: string };
}

export default function AdminPage() {
  const { ready, authenticated, login, getAccessToken } = useAuth();
  const [tab, setTab]           = useState<Tab>("organizers");
  const [organizers, setOrgs]   = useState<PendingOrganizer[]>([]);
  const [events, setEvents]     = useState<PendingEvent[]>([]);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [rankInputs, setRankInputs] = useState<Record<string, string>>({});
  const [msg, setMsg]           = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function authFetch(url: string, options: RequestInit = {}) {
    const token = await getAccessToken();
    return fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
    });
  }

  const loadOrgs   = () => authFetch("/api/admin/organizers?status=PENDING").then((r) => r.json()).then((d) => setOrgs(d.organizers ?? []));
  const loadEvents = () => authFetch("/api/admin/events?status=PENDING_APPROVAL").then((r) => r.json()).then((d) => setEvents(d.events ?? []));
  const loadActiveEvents = async () => {
    const [onSale, paused] = await Promise.all([
      authFetch("/api/admin/events?status=ON_SALE").then((r) => r.json()),
      authFetch("/api/admin/events?status=PAUSED").then((r) => r.json()),
    ]);
    const all: ActiveEvent[] = [...(onSale.events ?? []), ...(paused.events ?? [])];
    all.sort((a, b) => (a.featuredRank ?? 999) - (b.featuredRank ?? 999));
    setActiveEvents(all);
  };

  useEffect(() => {
    if (!ready || !authenticated) return;
    loadOrgs();
    loadEvents();
    loadActiveEvents();
  }, [ready, authenticated]);

  // rank: número fixa a posição; "auto" deixa o servidor escolher a próxima
  // livre; null remove o pin.
  const setFeatured = async (eventId: string, rank: number | "auto" | null) => {
    setMsg(null);
    setLoading(true);
    const r = await authFetch(`/api/admin/events/${eventId}/feature`, {
      method: "POST",
      body: JSON.stringify({ rank }),
    });
    const d = await r.json();
    if (r.ok) { setMsg("OK"); loadActiveEvents(); }
    else setMsg(d.error ?? "Erro");
    setLoading(false);
  };

  const action = async (url: string, onSuccess: () => void) => {
    setMsg(null);
    setLoading(true);
    const r = await authFetch(url, { method: "POST" });
    const d = await r.json();
    if (r.ok) { setMsg("OK"); onSuccess(); }
    else setMsg(d.error ?? d.detail ?? "Erro");
    setLoading(false);
  };

  if (!ready || !authenticated) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <EmptyState icon="cadeado" title="Login necessário." action={<Button onClick={login}>Entrar</Button>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <PageTitle action={<Badge variant="error">Admin</Badge>}>Painel Admin</PageTitle>

      <div className="mb-6 flex gap-2">
        {(["organizers","events","featured"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-laranja-500 text-noite-800" : "border border-border-strong text-text-muted hover:bg-white/5"
            }`}>
            {t === "organizers" ? `Organizadores (${organizers.length})` : t === "events" ? `Eventos (${events.length})` : "Destaques"}
          </button>
        ))}
      </div>

      {msg && <p className="mb-4 rounded-md border border-border px-3 py-2 text-sm text-text-muted">{msg}</p>}

      {tab === "organizers" && (
        <Panel title="Fila de aprovação — Organizadores">
          {organizers.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhum pendente.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {organizers.map((o) => (
                <div key={o.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-medium text-text">{o.companyName}</p>
                    <p className="text-xs text-text-muted">{o.document} · {o.user.email}</p>
                    <p className="truncate font-mono text-xs text-text-muted">{o.payoutWallet}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="success" disabled={loading} onClick={() => action(`/api/admin/organizers/${o.id}/approve`, loadOrgs)}>
                      Aprovar
                    </Button>
                    <Button size="sm" variant="danger" disabled={loading} onClick={() => action(`/api/admin/organizers/${o.id}/reject`, loadOrgs)}>
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "events" && (
        <Panel title="Fila de aprovação — Eventos">
          {events.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhum pendente.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((e) => (
                <div key={e.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-medium text-text">{e.title}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(e.eventDate).toLocaleDateString("pt-BR")} · {e.city}
                    </p>
                    <p className="text-xs text-text-muted">
                      {e.organizer.companyName} · {e.ticketPriceUsdc} USDC
                      {e.maxTickets ? ` · max ${e.maxTickets}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="success" disabled={loading} onClick={() => action(`/api/admin/events/${e.id}/approve`, loadEvents)}>
                      Aprovar
                    </Button>
                    <Button size="sm" variant="danger" disabled={loading} onClick={() => action(`/api/admin/events/${e.id}/reject`, loadEvents)}>
                      Rejeitar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={loading} onClick={() => action(`/api/admin/events/${e.id}/pause`, loadEvents)}>
                      {e.status === "PAUSED" ? "Retomar" : "Pausar"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "featured" && (
        <Panel title="Carrossel de destaques">
          <p className="mb-4 text-sm text-text-muted">
            Eventos com posição fixada aparecem primeiro no carrossel da home, na ordem definida.
            As vagas restantes são preenchidas automaticamente por vendas recentes.
          </p>
          {activeEvents.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhum evento em venda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeEvents.map((e) => (
                <div key={e.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-medium text-text">{e.title}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(e.eventDate).toLocaleDateString("pt-BR")} · {e.city} · {e.organizer.companyName}
                    </p>
                    {e.featuredRank !== null && (
                      <Badge variant="warning" className="mt-1">Fixado #{e.featuredRank}</Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* pr-8: o spinner nativo do input number fica dentro da caixa
                        de conteúdo e cobria o placeholder com px-4 + w-24. */}
                    <Field
                      type="number"
                      min="1"
                      placeholder="posição"
                      className="w-28 pr-8"
                      value={rankInputs[e.id] ?? ""}
                      onChange={(ev) => setRankInputs((p) => ({ ...p, [e.id]: ev.target.value }))}
                    />
                    {/* Sem posição informada, o servidor calcula a próxima livre. */}
                    <Button
                      size="sm"
                      disabled={loading}
                      onClick={() => setFeatured(e.id, rankInputs[e.id] ? Number(rankInputs[e.id]) : "auto")}
                    >
                      Fixar
                    </Button>
                    {e.featuredRank !== null && (
                      <Button size="sm" variant="ghost" disabled={loading} onClick={() => setFeatured(e.id, null)}>
                        Remover pin
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
