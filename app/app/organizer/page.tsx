"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import { PageTitle } from "../components/ui/PageTitle";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Field } from "../components/ui/Field";
import { EmptyState } from "../components/ui/EmptyState";
import { NewEventModal } from "../components/NewEventModal";

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
  maxTickets: number | null;
  _count: { tickets: number };
  checkins: number;
  primaryRevenueBrl: number;
  resaleVolumeBrl: number;
  royaltiesBrl: number;
}

// Evento recém-criado ainda não tem métricas nem contagem de tickets (nasceu
// agora, sem venda) — o POST devolve só o registro cru do Prisma (sem
// _count, sem agregados), então preenche tudo com zero em vez de deixar a
// linha nova quebrar o layout da tabela.
function withZeroMetrics(event: Omit<OrganizerEvent, "_count" | "checkins" | "primaryRevenueBrl" | "resaleVolumeBrl" | "royaltiesBrl">): OrganizerEvent {
  return { ...event, _count: { tickets: 0 }, checkins: 0, primaryRevenueBrl: 0, resaleVolumeBrl: 0, royaltiesBrl: 0 };
}

interface ApplyForm {
  companyName: string;
  document: string;
  payoutWallet: string;
}

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
  const [newEventOpen, setNewEventOpen] = useState(false);
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
      <PageTitle
        action={<Button onClick={() => setNewEventOpen(true)}>+ Novo evento</Button>}
      >
        Meus eventos
      </PageTitle>

      {msg && <p className="mb-4 text-sm text-text-muted">{msg}</p>}

      <NewEventModal
        open={newEventOpen}
        onClose={() => setNewEventOpen(false)}
        authFetch={authFetch}
        onCreated={(event) => {
          setMsg("Evento submetido para aprovação!");
          setEvents((prev) => [withZeroMetrics(event as Parameters<typeof withZeroMetrics>[0]), ...prev]);
        }}
      />

      {/* Events table */}
      {events.length === 0 ? (
        <EmptyState icon="ticket" title="Nenhum evento ainda." />
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="pb-2 pr-4 font-medium">Evento</th>
                  <th className="pb-2 pr-4 font-medium">Data</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Vendidos</th>
                  <th className="pb-2 pr-4 font-medium">Check-ins</th>
                  <th className="pb-2 pr-4 font-medium">Receita primária</th>
                  <th className="pb-2 pr-4 font-medium">Revenda</th>
                  <th className="pb-2 pr-4 font-medium">Royalties</th>
                  <th className="pb-2 font-medium">Preço</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const badge = statusBadge[e.status] ?? { label: e.status, variant: "neutral" as const };
                  const sold = e._count.tickets;
                  return (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-medium text-text">{e.title}</td>
                      <td className="py-2 pr-4 text-text-muted">
                        {new Date(e.eventDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 pr-4"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                      <td className="py-2 pr-4 text-text">
                        {sold}{e.maxTickets !== null ? ` / ${e.maxTickets}` : ""}
                      </td>
                      <td className="py-2 pr-4 text-text">{e.checkins}{sold > 0 ? ` / ${sold}` : ""}</td>
                      <td className="py-2 pr-4 text-text">R$ {e.primaryRevenueBrl.toFixed(2).replace(".", ",")}</td>
                      <td className="py-2 pr-4 text-text">R$ {e.resaleVolumeBrl.toFixed(2).replace(".", ",")}</td>
                      <td className="py-2 pr-4 text-text">R$ {e.royaltiesBrl.toFixed(2).replace(".", ",")}</td>
                      <td className="py-2 text-text">{e.ticketPriceUsdc} USDC</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
