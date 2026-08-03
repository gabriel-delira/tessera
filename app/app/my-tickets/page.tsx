"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import Link from "next/link";
import { PageTitle } from "../components/ui/PageTitle";
import { TicketRow } from "../components/ui/TicketRow";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { BalanceCard } from "../components/ui/BalanceCard";
import { Field } from "../components/ui/Field";
import { ViewToggle } from "../components/ui/ViewToggle";
import { AlbumGrid } from "../components/ui/AlbumGrid";
import { ListTicketModal } from "../components/ListTicketModal";
import type { Achievement } from "@/lib/achievements";

interface LedgerEntryView {
  id: string;
  type: string;
  amountBrl: number;
  description: string;
  onchainTxHash: string | null;
  createdAt: string;
}

interface TicketWithEvent {
  tokenId: number;
  ticketNumber: number;
  seat: string | null;
  status: string;
  mintedAt: string | null;
  facePrice: string;
  attended: boolean;
  event: {
    id: string;
    title: string;
    venue: string;
    city: string;
    eventDate: string;
    coverImageUrl: string | null;
  };
}

function RotatingQR({
  tokenId,
  getAccessToken,
}: {
  tokenId: number;
  getAccessToken: () => Promise<string | null>;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const prevSrc = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const resp = await fetch(`/api/me/tickets/${tokenId}/qr`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    if (prevSrc.current) URL.revokeObjectURL(prevSrc.current);
    prevSrc.current = url;
    setSrc(url);
  }, [tokenId, getAccessToken]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 28_000);
    return () => {
      clearInterval(id);
      if (prevSrc.current) URL.revokeObjectURL(prevSrc.current);
    };
  }, [refresh]);

  return (
    <div className="flex flex-col items-center gap-2">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`QR ingresso #${tokenId}`} className="h-[200px] w-[200px] rounded-lg border border-border" />
      ) : (
        <div className="h-[200px] w-[200px] animate-pulse rounded-lg bg-surface-2" />
      )}
      <p className="text-xs text-text-muted">Atualiza a cada 30s</p>
    </div>
  );
}

const statusBadge: Record<string, { label: string; variant: "success" | "info" | "neutral" }> = {
  VALID: { label: "Válido", variant: "success" },
  CHECKED_IN: { label: "Utilizado", variant: "info" },
};

// Mesma regra de elegibilidade do painel de venda em /market — VALID de
// evento futuro, ou VALID/CHECKED_IN de evento já ocorrido (colecionável).
function isListable(t: TicketWithEvent): boolean {
  const isPast = new Date(t.event.eventDate).getTime() < Date.now();
  return isPast ? (t.status === "VALID" || t.status === "CHECKED_IN") : t.status === "VALID";
}

export default function MyTicketsPage() {
  const { ready, authenticated, login, getAccessToken } = useAuth();
  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntryView[]>([]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKeyInput, setPixKeyInput] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [view, setView] = useState<"list" | "album">("list");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [listTokenId, setListTokenId] = useState<number | null>(null);
  const [listModalOpen, setListModalOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tessera:collection-view");
    if (saved === "list" || saved === "album") setView(saved);
  }, []);

  const changeView = (v: "list" | "album") => {
    setView(v);
    localStorage.setItem("tessera:collection-view", v);
  };

  const loadBalance = useCallback(async () => {
    const token = await getAccessToken();
    const r = await fetch("/api/me/balance", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const d = await r.json();
    setBalance(d.balanceBrl ?? 0);
    setLedger(d.entries ?? []);
  }, [getAccessToken]);

  const fetchTickets = useCallback(async () => {
    const token = await getAccessToken();
    const r = await fetch("/api/me/tickets", { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    setTickets(Array.isArray(data) ? data : []);
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { setLoading(false); return; }

    (async () => {
      await fetchTickets();
      setLoading(false);

      const token = await getAccessToken();
      const ar = await fetch("/api/me/album", { headers: { Authorization: `Bearer ${token}` } });
      if (ar.ok) { const ad = await ar.json(); setAchievements(ad.achievements ?? []); }
    })();
    loadBalance();
  }, [ready, authenticated, getAccessToken, loadBalance, fetchTickets]);

  const submitWithdraw = async () => {
    setWithdrawing(true);
    setWithdrawMsg(null);
    const token = await getAccessToken();
    if (pixKeyInput) {
      const pr = await fetch("/api/me/pix-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pixKey: pixKeyInput }),
      });
      if (!pr.ok) { setWithdrawMsg("Erro ao salvar chave PIX"); setWithdrawing(false); return; }
    }
    const r = await fetch("/api/me/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amountBrl: parseFloat(withdrawAmount) }),
    });
    const d = await r.json();
    setWithdrawing(false);
    if (!r.ok) { setWithdrawMsg(d.error ?? "Erro ao solicitar saque"); return; }
    setWithdrawOpen(false);
    setWithdrawAmount("");
    setPixKeyInput("");
    loadBalance();
  };

  const selectedTicket = tickets.find((t) => t.tokenId === selected) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageTitle>Minha Coleção</PageTitle>

      {ready && authenticated && !loading && (
        <>
          <BalanceCard balanceBrl={balance} onWithdraw={() => setWithdrawOpen(true)} />
          {ledger.length > 0 && (
            <button
              onClick={() => setStatementOpen(true)}
              className="mb-8 -mt-4 block text-xs text-text-muted underline"
            >
              Ver extrato completo
            </button>
          )}
        </>
      )}

      {!ready || loading ? (
        <p className="text-text-muted">Carregando…</p>
      ) : !authenticated ? (
        <EmptyState
          icon="ticket"
          title="Faça login para ver sua coleção."
          action={<Button onClick={login}>Entrar</Button>}
        />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon="quadrifolio"
          title="Sua coleção começa aqui."
          description="Você ainda não tem ingressos."
          action={
            <Link href="/">
              <Button variant="secondary">Ver eventos</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ViewToggle value={view} onChange={changeView} />

          {view === "list" ? (
            <div className="flex flex-col gap-4">
              {tickets.map((t, i) => {
                const badge = statusBadge[t.status] ?? { label: t.status, variant: "neutral" as const };
                const frozen = t.status !== "VALID" && t.status !== "CHECKED_IN";
                return (
                  <TicketRow
                    key={t.tokenId}
                    thumbGrad={i}
                    frozen={frozen}
                    title={t.event.title}
                    subtitle={`${new Date(t.event.eventDate).toLocaleString("pt-BR")} · ${t.event.venue}, ${t.event.city} · Ingresso #${t.ticketNumber}${t.seat ? ` · Assento ${t.seat}` : ""}`}
                    badge={<Badge variant={badge.variant}>{badge.label}</Badge>}
                    actions={
                      t.status === "VALID" || isListable(t) ? (
                        <>
                          {t.status === "VALID" && (
                            <Button size="sm" onClick={() => setSelected(t.tokenId)}>Ver QR</Button>
                          )}
                          {isListable(t) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => { setListTokenId(t.tokenId); setListModalOpen(true); }}
                            >
                              Anunciar
                            </Button>
                          )}
                        </>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          ) : (
            <AlbumGrid
              achievements={achievements}
              onSelect={(tokenId) => {
                const t = tickets.find((x) => x.tokenId === tokenId);
                if (t?.status === "VALID") setSelected(tokenId); // QR só faz sentido para ingresso válido
              }}
              tickets={tickets.map((t) => ({
                tokenId: t.tokenId,
                status: t.status,
                eventTitle: t.event.title,
                eventDate: t.event.eventDate,
                venue: t.event.venue,
                city: t.event.city,
                coverImageUrl: t.event.coverImageUrl,
                attended: t.attended,
              }))}
            />
          )}
        </>
      )}

      <Modal open={!!selectedTicket} onClose={() => setSelected(null)} title={selectedTicket?.event.title}>
        {selectedTicket && (
          <RotatingQR tokenId={selectedTicket.tokenId} getAccessToken={getAccessToken} />
        )}
      </Modal>

      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Sacar via PIX">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">Saldo disponível: R$ {balance.toFixed(2).replace(".", ",")}</p>
          <Field
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0.01"
            max={balance}
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
          />
          <Field
            label="Chave PIX (deixe em branco para manter a atual)"
            placeholder="CPF, e-mail, telefone ou chave aleatória"
            value={pixKeyInput}
            onChange={(e) => setPixKeyInput(e.target.value)}
          />
          {withdrawMsg && <p className="text-xs text-erro-on-dark">{withdrawMsg}</p>}
          <Button
            onClick={submitWithdraw}
            disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) > balance}
          >
            {withdrawing ? "Processando…" : "Confirmar saque"}
          </Button>
        </div>
      </Modal>

      <Modal open={statementOpen} onClose={() => setStatementOpen(false)} title="Extrato">
        <div className="flex flex-col gap-3">
          {ledger.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
              <div>
                <p className="text-text">{e.description}</p>
                <p className="text-xs text-text-muted">{new Date(e.createdAt).toLocaleString("pt-BR")}</p>
              </div>
              <span className={`font-semibold tabular-nums ${e.amountBrl >= 0 ? "text-sucesso-on-dark" : "text-erro-on-dark"}`}>
                {e.amountBrl >= 0 ? "+" : ""}R$ {e.amountBrl.toFixed(2).replace(".", ",")}
              </span>
            </div>
          ))}
        </div>
      </Modal>

      <ListTicketModal
        open={listModalOpen}
        tokenId={listTokenId}
        ticketLabel={
          (() => {
            const t = tickets.find((x) => x.tokenId === listTokenId);
            return t ? `#${t.ticketNumber} · ${t.event.title} (token #${t.tokenId})` : "";
          })()
        }
        onClose={() => setListModalOpen(false)}
        onListed={() => { setListTokenId(null); fetchTickets(); }}
      />
    </div>
  );
}
