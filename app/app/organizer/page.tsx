"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import { PageTitle } from "../components/ui/PageTitle";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Field, TextareaField, SelectField } from "../components/ui/Field";
import { EmptyState } from "../components/ui/EmptyState";

interface LedgerRow {
  id: string;
  amountBrl: number;
  description: string;
  eventTitle: string | null;
  onchainTxHash: string | null;
  onchainVerified: boolean | null;
  createdAt: string;
}

interface OrganizerEvent {
  id: string;
  title: string;
  city: string;
  eventDate: string;
  status: string;
  ticketPriceUsdc: number;
  _count: { tickets: number };
}

interface ApplyForm {
  companyName: string;
  document: string;
  payoutWallet: string;
}

interface NewEventForm {
  title: string;
  description: string;
  venue: string;
  city: string;
  coverImageUrl: string;
  coverVideoUrl: string;
  eventDate: string;
  ticketPriceUsdc: string;
  maxTickets: string;
  category: string;
  subcategory: string;
  lineup: string;
  doorsOpenAt: string;
  maxResaleBps: string;
}

const CATEGORY_OPTIONS = [
  { value: "SHOW", label: "Show" },
  { value: "FESTIVAL", label: "Festival" },
  { value: "TEATRO", label: "Teatro" },
  { value: "ESPORTE", label: "Esporte" },
  { value: "CONFERENCIA", label: "Conferência" },
  { value: "OUTRO", label: "Outro" },
];

// LAYOUT_UPDATE.md §5.5 — opções usuais + "sem limite". O organizador pode
// afrouxar depois, nunca apertar (apertar quebraria anúncios já publicados).
const RESALE_CAP_OPTIONS = [
  { value: "", label: "Sem limite (mercado livre)" },
  { value: "10000", label: "Até 100% do preço original" },
  { value: "15000", label: "Até 150% do preço original" },
  { value: "20000", label: "Até 200% do preço original" },
];

const statusBadge: Record<string, { label: string; variant: "success" | "error" | "warning" | "neutral" }> = {
  ON_SALE: { label: "Em venda", variant: "success" },
  PAUSED: { label: "Pausado", variant: "warning" },
  REJECTED: { label: "Rejeitado", variant: "error" },
};

export default function OrganizerPage() {
  const { ready, authenticated, login, getAccessToken } = useAuth();
  const [events, setEvents]         = useState<OrganizerEvent[]>([]);
  const [status, setStatus]         = useState<"loading" | "no-org" | "pending" | "ready">("loading");
  const [applyForm, setApplyForm]   = useState<ApplyForm>({ companyName: "", document: "", payoutWallet: "" });
  const [newEvent, setNewEvent]     = useState<NewEventForm>({
    title: "", description: "", venue: "", city: "",
    coverImageUrl: "", coverVideoUrl: "",
    eventDate: "", ticketPriceUsdc: "", maxTickets: "",
    category: "OUTRO", subcategory: "", lineup: "", doorsOpenAt: "", maxResaleBps: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  async function authFetch(url: string, options: RequestInit = {}) {
    const token = await getAccessToken();
    return fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
    });
  }

  useEffect(() => {
    if (!ready || !authenticated) return;
    authFetch("/api/organizer/events").then(async (r) => {
      if (r.status === 403) { setStatus("no-org"); return; }
      const d = await r.json();
      if (d.error === "Organizer not approved yet") { setStatus("pending"); return; }
      setEvents(d.events ?? []);
      setStatus("ready");
      const lr = await authFetch("/api/organizer/ledger");
      if (lr.ok) { const ld = await lr.json(); setLedger(ld.entries ?? []); }
    });
  }, [ready, authenticated]);

  const handleApply = async () => {
    setMsg(null);
    const r = await authFetch("/api/organizer/apply", { method: "POST", body: JSON.stringify(applyForm) });
    const d = await r.json();
    if (r.ok) { setMsg("Solicitação enviada! Aguarde a aprovação do admin."); setStatus("pending"); }
    else setMsg(d.error ?? "Erro ao enviar");
  };

  const handleCreateEvent = async () => {
    setMsg(null);
    const r = await authFetch("/api/organizer/events", {
      method: "POST",
      body: JSON.stringify({
        ...newEvent,
        ticketPriceUsdc: parseFloat(newEvent.ticketPriceUsdc),
        maxTickets: newEvent.maxTickets ? parseInt(newEvent.maxTickets) : null,
        maxResaleBps: newEvent.maxResaleBps ? parseInt(newEvent.maxResaleBps) : null,
      }),
    });
    const d = await r.json();
    if (r.ok) {
      setMsg("Evento submetido para aprovação!");
      setEvents((prev) => [d.event, ...prev]);
      setNewEvent({
        title:"",description:"",venue:"",city:"",coverImageUrl:"",coverVideoUrl:"",eventDate:"",ticketPriceUsdc:"",maxTickets:"",
        category:"OUTRO",subcategory:"",lineup:"",doorsOpenAt:"",maxResaleBps:"",
      });
    } else setMsg(d.error ?? "Erro ao criar evento");
  };

  if (!ready || !authenticated) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <EmptyState
          icon="coluna"
          title="Faça login para acessar a área do organizador."
          action={<Button onClick={login}>Entrar</Button>}
        />
      </div>
    );
  }

  if (status === "loading") return <div className="p-10 text-text-muted">Carregando…</div>;

  if (status === "no-org") {
    return (
      <div className="mx-auto max-w-md px-6 py-10">
        <PageTitle>Seja um organizador</PageTitle>
        <div className="flex flex-col gap-3">
          <Field
            placeholder="Nome da empresa"
            value={applyForm.companyName}
            onChange={(e) => setApplyForm((p) => ({ ...p, companyName: e.target.value }))}
          />
          <Field
            placeholder="CNPJ"
            value={applyForm.document}
            onChange={(e) => setApplyForm((p) => ({ ...p, document: e.target.value }))}
          />
          <Field
            placeholder="Carteira de pagamento (0x…)"
            value={applyForm.payoutWallet}
            onChange={(e) => setApplyForm((p) => ({ ...p, payoutWallet: e.target.value }))}
          />
          <Button onClick={handleApply}>Enviar solicitação</Button>
          {msg && <p className="text-sm text-text-muted">{msg}</p>}
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="mx-auto max-w-md px-6 py-10">
        <EmptyState icon="relogio" title="Solicitação em análise." description="Aguarde a aprovação do administrador." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <PageTitle>Meus eventos</PageTitle>

      {/* New event form */}
      <details className="mb-8 rounded-lg border border-border bg-surface p-5">
        <summary className="cursor-pointer text-sm font-semibold text-text">+ Novo evento</summary>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { f: "title" as const,           ph: "Título do evento" },
            { f: "venue" as const,           ph: "Local / venue" },
            { f: "city" as const,            ph: "Cidade" },
            { f: "eventDate" as const,       ph: "Data (YYYY-MM-DDTHH:MM)", type: "datetime-local" },
            { f: "doorsOpenAt" as const,     ph: "Abertura dos portões (opcional)", type: "datetime-local" },
            { f: "ticketPriceUsdc" as const, ph: "Preço em USDC (ex: 45.00)" },
            { f: "maxTickets" as const,      ph: "Máximo de ingressos (opcional)" },
            { f: "subcategory" as const,     ph: "Subcategoria (ex: Rock, Stand-up)" },
            { f: "lineup" as const,          ph: "Line-up / atrações (opcional)" },
            { f: "coverImageUrl" as const,   ph: "URL da imagem de capa (opcional)" },
            { f: "coverVideoUrl" as const,   ph: "URL do vídeo de capa — usado só no carrossel de destaque (opcional)" },
          ].map(({ f, ph, type }) => (
            <Field key={f} type={type ?? "text"} placeholder={ph}
              value={newEvent[f]}
              onChange={(e) => setNewEvent((p) => ({ ...p, [f]: e.target.value }))}
            />
          ))}
          <SelectField
            value={newEvent.category}
            onChange={(e) => setNewEvent((p) => ({ ...p, category: e.target.value }))}
          >
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </SelectField>
          <SelectField
            label="Teto de revenda"
            value={newEvent.maxResaleBps}
            onChange={(e) => setNewEvent((p) => ({ ...p, maxResaleBps: e.target.value }))}
          >
            {RESALE_CAP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>
          <TextareaField placeholder="Descrição (opcional)"
            value={newEvent.description}
            onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
            className="col-span-full h-20"
          />
          <Button onClick={handleCreateEvent} className="col-span-full">
            Submeter para aprovação
          </Button>
        </div>
        {msg && <p className="mt-2 text-sm text-text-muted">{msg}</p>}
      </details>

      {/* Events table */}
      {events.length === 0 ? (
        <EmptyState icon="ticket" title="Nenhum evento ainda." />
      ) : (
        <Panel>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="pb-2 font-medium">Evento</th>
                <th className="pb-2 font-medium">Data</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Vendidos</th>
                <th className="pb-2 font-medium">Preço</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const badge = statusBadge[e.status] ?? { label: e.status, variant: "neutral" as const };
                return (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium text-text">{e.title}</td>
                    <td className="py-2 pr-4 text-text-muted">
                      {new Date(e.eventDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-2 pr-4"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                    <td className="py-2 pr-4 text-text">{e._count.tickets}</td>
                    <td className="py-2 text-text">{e.ticketPriceUsdc} USDC</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      {/* Extrato de royalties — LAYOUT_UPDATE.md §5.7.2: interface do atestado
          on-chain, não o atestado em si. Cada linha é conferida contra o
          evento TicketSettled da própria transação de settle. */}
      {ledger.length > 0 && (
        <Panel title="Extrato de royalties de revenda" className="mt-8">
          <div className="flex flex-col gap-2">
            {ledger.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
                <div>
                  <p className="text-text">{l.description}</p>
                  <p className="text-xs text-text-muted">{new Date(l.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums text-text">R$ {l.amountBrl.toFixed(2).replace(".", ",")}</span>
                  {l.onchainVerified === true && <Badge variant="success">Conferido on-chain ✓</Badge>}
                  {l.onchainVerified === false && <Badge variant="error">Divergente</Badge>}
                  {l.onchainVerified === null && l.onchainTxHash && <Badge variant="neutral">Verificando…</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
