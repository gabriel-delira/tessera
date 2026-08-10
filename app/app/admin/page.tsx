"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import { PageTitle } from "../components/ui/PageTitle";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Field } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { Icon } from "../components/ui/Icon";

type Tab = "organizers" | "events" | "featured" | "customers";

interface PendingOrganizer {
  id: string;
  companyName: string;
  document: string;
  payoutWallet: string;
  status: string;
  blocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  user: { email: string | null };
}

interface TicketTypeInfo {
  id: string;
  label: string;
  priceUsdc: number;
  quantity: number | null;
  dayIds: string[];
  areaId: string | null;
  lotNumber: number;
  salesEndAt: string | null;
  earlyEntryMinutes: number | null;
  _count: { tickets: number };
}

interface PendingEvent {
  id: string;
  title: string;
  description: string | null;
  venue: string;
  city: string;
  coverImageUrl: string | null;
  eventDate: string;
  endDate: string;
  doorsOpenAt: string | null;
  category: string;
  subcategory: string | null;
  lineup: string | null;
  ticketPriceUsdc: number;
  maxTickets: number | null;
  status: string;
  reservedTickets: number;
  reservedTicketsAssigned: number;
  ticketDays: { id: string; name: string }[] | null;
  ticketAreas: { id: string; name: string }[] | null;
  ticketTypes: TicketTypeInfo[];
  accessCodesTotal: number;
  accessCodesUsed: number;
  accessCodesRevoked: number;
  organizer: { companyName: string; document: string };
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

interface Customer {
  id: string;
  email: string | null;
  displayName: string | null;
  cpf: string | null;
  walletAddress: string | null;
  role: string;
  kycLevel: string;
  verified: boolean;
  blocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  createdAt: string;
  purchasesCompleted: number;
  totalSpentBrl: number;
  salesCompleted: number;
}

interface CustomerDetail {
  user: Customer;
  purchases: {
    id: string;
    eventTitle: string;
    amountBrl: number;
    amountUsdc: number;
    status: string;
    paymentMethod: string;
    isGift: boolean;
    recipient: string | null;
    createdAt: string;
  }[];
  sales: { id: string; tokenId: number; eventTitle: string; priceUsdc: number; status: string; createdAt: string }[];
  checkins: { id: string; eventTitle: string; tokenId: number; scannedAt: string }[];
}

export default function AdminPage() {
  const { ready, authenticated, login, getAccessToken } = useAuth();
  const [tab, setTab]           = useState<Tab>("organizers");
  const [organizers, setOrgs]   = useState<PendingOrganizer[]>([]);
  const [approvedOrgs, setApprovedOrgs] = useState<PendingOrganizer[]>([]);
  const [events, setEvents]     = useState<PendingEvent[]>([]);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [rankInputs, setRankInputs] = useState<Record<string, string>>({});
  const [msg, setMsg]           = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [detailEvent, setDetailEvent] = useState<PendingEvent | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);

  async function authFetch(url: string, options: RequestInit = {}) {
    const token = await getAccessToken();
    return fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
    });
  }

  const loadOrgs   = () => authFetch("/api/admin/organizers?status=PENDING").then((r) => r.json()).then((d) => setOrgs(d.organizers ?? []));
  const loadApprovedOrgs = () => authFetch("/api/admin/organizers?status=APPROVED").then((r) => r.json()).then((d) => setApprovedOrgs(d.organizers ?? []));
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
  const loadCustomers = () => {
    const qs = customerQuery.trim() ? `?q=${encodeURIComponent(customerQuery.trim())}` : "";
    return authFetch(`/api/admin/customers${qs}`).then((r) => r.json()).then((d) => setCustomers(d.customers ?? []));
  };

  useEffect(() => {
    if (!ready || !authenticated) return;
    loadOrgs();
    loadApprovedOrgs();
    loadEvents();
    loadActiveEvents();
    loadCustomers();
  }, [ready, authenticated]);

  useEffect(() => {
    if (!ready || !authenticated || tab !== "customers") return;
    const t = setTimeout(loadCustomers, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerQuery, tab]);

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

  const blockWithReason = async (url: string, onSuccess: () => void) => {
    const reason = window.prompt("Motivo do bloqueio (opcional):") ?? "";
    setMsg(null);
    setLoading(true);
    const r = await authFetch(url, { method: "POST", body: JSON.stringify({ reason }) });
    const d = await r.json();
    if (r.ok) { setMsg("OK"); onSuccess(); }
    else setMsg(d.error ?? d.detail ?? "Erro");
    setLoading(false);
  };

  const openCustomerDetail = async (id: string) => {
    const r = await authFetch(`/api/admin/customers/${id}`);
    const d = await r.json();
    if (r.ok) setCustomerDetail(d);
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

      <div className="mb-6 flex flex-wrap gap-2">
        {(["organizers","events","featured","customers"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-laranja-500 text-noite-800" : "border border-border-strong text-text-muted hover:bg-white/5"
            }`}>
            {t === "organizers" ? `Organizadores (${organizers.length})` : t === "events" ? `Eventos (${events.length})` : t === "featured" ? "Destaques" : `Clientes (${customers.length})`}
          </button>
        ))}
      </div>

      {msg && <p className="mb-4 rounded-md border border-border px-3 py-2 text-sm text-text-muted">{msg}</p>}

      {tab === "organizers" && (
        <div className="flex flex-col gap-6">
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
                      <Button size="sm" variant="success" disabled={loading} onClick={() => action(`/api/admin/organizers/${o.id}/approve`, () => { loadOrgs(); loadApprovedOrgs(); })}>
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

          <Panel title={`Organizadores aprovados (${approvedOrgs.length})`}>
            {approvedOrgs.length === 0 ? (
              <p className="text-sm text-text-muted">Nenhum organizador aprovado ainda.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {approvedOrgs.map((o) => (
                  <div key={o.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-text">{o.companyName}</p>
                        <Badge variant="success">Aprovado</Badge>
                        {o.blocked && <Badge variant="error">Bloqueado</Badge>}
                      </div>
                      <p className="text-xs text-text-muted">{o.document} · {o.user.email}</p>
                      <p className="truncate font-mono text-xs text-text-muted">{o.payoutWallet}</p>
                      {o.blocked && o.blockedReason && (
                        <p className="mt-1 text-xs text-erro-on-dark">Motivo: {o.blockedReason}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {o.blocked ? (
                        <Button size="sm" variant="success" disabled={loading} onClick={() => action(`/api/admin/organizers/${o.id}/unblock`, loadApprovedOrgs)}>
                          Desbloquear
                        </Button>
                      ) : (
                        <Button size="sm" variant="danger" disabled={loading} onClick={() => blockWithReason(`/api/admin/organizers/${o.id}/block`, loadApprovedOrgs)}>
                          Bloquear
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
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
                    <Button size="sm" variant="ghost" onClick={() => setDetailEvent(e)}>
                      Ver detalhes
                    </Button>
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

      {tab === "customers" && (
        <Panel title="Clientes">
          <Field
            placeholder="Buscar por nome, e-mail, CPF ou carteira…"
            className="mb-4"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
          />
          {customers.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhum cliente com compra ou venda concluída ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {customers.map((c) => (
                <div key={c.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-text">{c.displayName ?? c.email ?? c.walletAddress ?? c.id}</p>
                      <Badge variant="neutral">{c.role}</Badge>
                      {c.verified && <Badge variant="info">Verificado</Badge>}
                      {c.blocked && <Badge variant="error">Bloqueado</Badge>}
                    </div>
                    <p className="text-xs text-text-muted">
                      {c.email ?? "sem e-mail"} {c.cpf ? `· CPF ${c.cpf}` : ""}
                    </p>
                    {c.walletAddress && (
                      <p className="truncate font-mono text-xs text-text-muted">{c.walletAddress}</p>
                    )}
                    <p className="mt-1 text-xs text-text-muted">
                      {c.purchasesCompleted} compra(s) · R$ {c.totalSpentBrl.toFixed(2).replace(".", ",")} gastos · {c.salesCompleted} venda(s) concluída(s)
                    </p>
                    {c.blocked && c.blockedReason && (
                      <p className="mt-1 text-xs text-erro-on-dark">Motivo: {c.blockedReason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openCustomerDetail(c.id)}>
                      Ver detalhes
                    </Button>
                    {c.blocked ? (
                      <Button size="sm" variant="success" disabled={loading} onClick={() => action(`/api/admin/customers/${c.id}/unblock`, loadCustomers)}>
                        Desbloquear
                      </Button>
                    ) : (
                      <Button size="sm" variant="danger" disabled={loading} onClick={() => blockWithReason(`/api/admin/customers/${c.id}/block`, loadCustomers)}>
                        Bloquear
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Modal open={!!detailEvent} onClose={() => setDetailEvent(null)} title={detailEvent?.title} size="large">
        {detailEvent && (
          <div className="flex flex-col gap-4">
            {detailEvent.coverImageUrl && (
              <img
                src={detailEvent.coverImageUrl}
                alt=""
                className="h-48 w-full rounded-lg object-cover"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">{detailEvent.category}{detailEvent.subcategory ? ` · ${detailEvent.subcategory}` : ""}</Badge>
              <Badge>{detailEvent.status}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm text-text-muted sm:grid-cols-2">
              <p className="flex items-center gap-1.5"><Icon name="calendario" /> {new Date(detailEvent.eventDate).toLocaleString("pt-BR")} — {new Date(detailEvent.endDate).toLocaleString("pt-BR")}</p>
              {detailEvent.doorsOpenAt && (
                <p>Portões: {new Date(detailEvent.doorsOpenAt).toLocaleString("pt-BR")}</p>
              )}
              <p>{detailEvent.venue}, {detailEvent.city}</p>
              <p>{detailEvent.organizer.companyName} · {detailEvent.organizer.document}</p>
              <p>{detailEvent.ticketPriceUsdc} USDC{detailEvent.maxTickets ? ` · máx ${detailEvent.maxTickets} ingressos` : ""}</p>
            </div>
            {detailEvent.lineup && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Line-up</p>
                <p className="text-sm text-text">{detailEvent.lineup}</p>
              </div>
            )}
            {detailEvent.description ? (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Descrição</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-text">{detailEvent.description}</p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Organizador não preencheu descrição.</p>
            )}

            {/* Matriz de ingressos — dia × área × lote, com quanto já foi mintado
                por tipo. É o que dá ao admin visibilidade real da oferta, não só
                o preço de vitrine do evento. */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                Lotes e tipos de ingresso ({detailEvent.ticketTypes.length})
              </p>
              {detailEvent.ticketTypes.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhum tipo de ingresso configurado.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-2 text-text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">Lote</th>
                        <th className="px-3 py-2 font-medium">Dias</th>
                        <th className="px-3 py-2 font-medium">Área</th>
                        <th className="px-3 py-2 font-medium">Preço</th>
                        <th className="px-3 py-2 font-medium">Cota</th>
                        <th className="px-3 py-2 font-medium">Mintados</th>
                        <th className="px-3 py-2 font-medium">Vendas até</th>
                        <th className="px-3 py-2 font-medium">Entrada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailEvent.ticketTypes.map((t) => (
                        <tr key={t.id} className="border-t border-border">
                          <td className="px-3 py-2 text-text">
                            {t.label} <span className="text-text-muted">#{t.lotNumber}</span>
                            {t.dayIds.length > 1 && <Badge variant="info" className="ml-1.5">Passe</Badge>}
                          </td>
                          <td className="px-3 py-2 text-text-muted">
                            {t.dayIds.length === 0
                              ? "—"
                              : t.dayIds
                                  .map((id) => detailEvent.ticketDays?.find((d) => d.id === id)?.name)
                                  .filter(Boolean)
                                  .join(", ")}
                          </td>
                          <td className="px-3 py-2 text-text-muted">{detailEvent.ticketAreas?.find((a) => a.id === t.areaId)?.name ?? "—"}</td>
                          <td className="px-3 py-2 text-text-muted">{t.priceUsdc} USDC</td>
                          <td className="px-3 py-2 text-text-muted">{t.quantity ?? "sem cota própria"}</td>
                          <td className="px-3 py-2 text-text-muted">{t._count.tickets}</td>
                          <td className="px-3 py-2 text-text-muted">{t.salesEndAt ? new Date(t.salesEndAt).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="px-3 py-2 text-text-muted">{t.earlyEntryMinutes ? `${t.earlyEntryMinutes} min antes` : "na abertura"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Reserva do organizador</p>
                <p className="mt-1 text-text">
                  {detailEvent.reservedTicketsAssigned} / {detailEvent.reservedTickets} usada(s)
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Códigos de acesso avulsos</p>
                <p className="mt-1 text-text">
                  {detailEvent.accessCodesTotal} gerado(s) · {detailEvent.accessCodesUsed} usado(s) · {detailEvent.accessCodesRevoked} revogado(s)
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="success"
                disabled={loading}
                onClick={() => { action(`/api/admin/events/${detailEvent.id}/approve`, loadEvents); setDetailEvent(null); }}
              >
                Aprovar
              </Button>
              <Button
                variant="danger"
                disabled={loading}
                onClick={() => { action(`/api/admin/events/${detailEvent.id}/reject`, loadEvents); setDetailEvent(null); }}
              >
                Rejeitar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!customerDetail} onClose={() => setCustomerDetail(null)} title={customerDetail?.user.displayName ?? customerDetail?.user.email ?? "Cliente"} size="large">
        {customerDetail && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{customerDetail.user.role}</Badge>
              <Badge variant="info">KYC {customerDetail.user.kycLevel}</Badge>
              {customerDetail.user.verified && <Badge variant="info">Verificado</Badge>}
              {customerDetail.user.blocked && <Badge variant="error">Bloqueado</Badge>}
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm text-text-muted sm:grid-cols-2">
              <p>{customerDetail.user.email ?? "sem e-mail"}</p>
              <p>{customerDetail.user.cpf ? `CPF ${customerDetail.user.cpf}` : "sem CPF"}</p>
              <p className="truncate font-mono sm:col-span-2">{customerDetail.user.walletAddress ?? "sem carteira"}</p>
              <p>Cliente desde {new Date(customerDetail.user.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                <Icon name="cartao" /> Compras ({customerDetail.purchases.length})
              </p>
              {customerDetail.purchases.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhuma compra.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {customerDetail.purchases.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
                      <span className="text-text">{p.eventTitle}{p.isGift && p.recipient ? ` → presente p/ ${p.recipient}` : ""}</span>
                      <span className="text-text-muted">
                        R$ {p.amountBrl.toFixed(2).replace(".", ",")} · {p.paymentMethod} · <Badge variant={p.status === "COMPLETED" ? "success" : p.status === "FAILED" || p.status === "REFUNDED" ? "error" : "warning"}>{p.status}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                <Icon name="moeda" /> Anúncios de revenda ({customerDetail.sales.length})
              </p>
              {customerDetail.sales.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhum anúncio de revenda.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {customerDetail.sales.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
                      <span className="text-text">{s.eventTitle} · #{s.tokenId}</span>
                      <span className="text-text-muted">{s.priceUsdc} USDC · <Badge variant={s.status === "SOLD" ? "success" : s.status === "CANCELLED" || s.status === "EXPIRED" ? "error" : "neutral"}>{s.status}</Badge></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                <Icon name="scanner" /> Check-ins ({customerDetail.checkins.length})
              </p>
              {customerDetail.checkins.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhum check-in.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {customerDetail.checkins.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
                      <span className="text-text">{c.eventTitle} · #{c.tokenId}</span>
                      <span className="text-text-muted">{new Date(c.scannedAt).toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {customerDetail.user.blocked ? (
                <Button variant="success" disabled={loading} onClick={() => { action(`/api/admin/customers/${customerDetail.user.id}/unblock`, loadCustomers); setCustomerDetail(null); }}>
                  Desbloquear
                </Button>
              ) : (
                <Button variant="danger" disabled={loading} onClick={() => { blockWithReason(`/api/admin/customers/${customerDetail.user.id}/block`, loadCustomers); setCustomerDetail(null); }}>
                  Bloquear
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
