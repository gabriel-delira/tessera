"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import { PageTitle } from "../components/ui/PageTitle";
import { Panel } from "../components/ui/Panel";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { SelectField, Field } from "../components/ui/Field";
import { Tabs } from "../components/ui/Tabs";
import { CollectibleCard } from "../components/ui/CollectibleCard";
import { NegotiationsPanel } from "../components/NegotiationsPanel";
import { ListTicketModal } from "../components/ListTicketModal";

interface MarketListing {
  id: string;
  onchainListingId: number;
  tokenId: number;
  sellerAddress: string;
  priceUsdc: number;
  priceBrl: number;
  expiresAt: string | null;
  isCollectible: boolean;
  attendedEvent: boolean;
  sellerReceivesBrl: number;
  organizerRoyaltyBrl: number;
  platformTotalBrl: number;
  ticket: {
    tokenId: number;
    ticketNumber: number;
    seat: string | null;
    facePrice: number;
    event: {
      id: string;
      title: string;
      venue: string;
      city: string;
      eventDate: string;
      coverImageUrl: string | null;
    };
  };
}

interface MyTicket {
  tokenId: number;
  ticketNumber: number;
  status: string;
  event: { title: string; eventDate: string };
}

interface CheckoutState {
  listingId: string;
  pixCode: string;
  qrCodeUrl: string;
  amountBrl: number;
  purchaseId: string;
}

type MarketTab = "tickets" | "collectibles";

export default function MarketPage() {
  const { ready, authenticated, login, getAccessToken, walletAddress } = useAuth();

  const [tab, setTab]             = useState<MarketTab>("tickets");
  const [listings, setListings]   = useState<MarketListing[]>([]);
  const [myTickets, setMyTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading]     = useState(true);
  const [checkout, setCheckout]   = useState<CheckoutState | null>(null);
  const [details, setDetails]     = useState<MarketListing | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [proposeTarget, setProposeTarget] = useState<MarketListing | null>(null);
  const [proposeAmount, setProposeAmount] = useState("");
  const [proposeMsg, setProposeMsg] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);

  const myAddress = walletAddress;

  const fetchListings = useCallback(async (t: MarketTab) => {
    setLoading(true);
    const r = await fetch(`/api/market?tab=${t}`);
    const data = await r.json();
    setListings(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const fetchMyTickets = useCallback(async () => {
    if (!authenticated) return;
    const token = await getAccessToken();
    const r = await fetch("/api/me/tickets", { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    setMyTickets(Array.isArray(data) ? data : []);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    fetchListings(tab);
    if (authenticated) fetchMyTickets();
  }, [ready, authenticated, tab, fetchListings, fetchMyTickets]);

  // Ingressos elegíveis para anúncio na aba corrente — §5: VALID de evento
  // futuro na aba "tickets"; VALID ou CHECKED_IN de evento passado em "collectibles".
  const sellableTickets = myTickets.filter((t) => {
    const isPast = new Date(t.event.eventDate).getTime() < Date.now();
    if (tab === "collectibles") return isPast && (t.status === "VALID" || t.status === "CHECKED_IN");
    return !isPast && t.status === "VALID";
  });
  const selectedTicket = sellableTickets.find((t) => t.tokenId === selectedTokenId) ?? null;

  const handleBuy = async (listing: MarketListing) => {
    if (!authenticated) { login(); return; }
    const token = await getAccessToken();
    const r = await fetch(`/api/listings/${listing.id}/checkout`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await r.json();
    if (!r.ok) { alert(data.error ?? "Erro ao iniciar checkout"); return; }
    setCheckout({
      listingId:  listing.id,
      pixCode:    data.pixCode,
      qrCodeUrl:  data.qrCodeUrl,
      amountBrl:  data.amountBrl,
      purchaseId: data.purchaseId,
    });
  };

  const submitProposal = async () => {
    if (!proposeTarget || !proposeAmount) return;
    setProposing(true);
    setProposeMsg(null);
    const token = await getAccessToken();
    const r = await fetch("/api/negotiations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ listingId: proposeTarget.id, priceUsdc: parseFloat(proposeAmount) }),
    });
    const d = await r.json();
    setProposing(false);
    if (!r.ok) { setProposeMsg(d.error ?? "Erro ao enviar proposta"); return; }
    setProposeTarget(null);
    setProposeAmount("");
  };

  const handleCancel = async (listing: MarketListing) => {
    const token = await getAccessToken();
    const r = await fetch(`/api/listings/${listing.id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      setDetails(null);
      fetchListings(tab);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <PageTitle>Mercado</PageTitle>

      <Tabs
        active={tab}
        onChange={(v) => setTab(v as MarketTab)}
        tabs={[
          { value: "tickets", label: "Ingressos" },
          { value: "collectibles", label: "Colecionáveis" },
        ]}
      />

      {authenticated && (
        <NegotiationsPanel getAccessToken={getAccessToken} onChanged={() => fetchListings(tab)} />
      )}

      {/* Sell panel */}
      {authenticated && sellableTickets.length > 0 && (
        <Panel title={tab === "collectibles" ? "Anunciar colecionável" : "Listar ingresso para venda"} className="mb-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <SelectField
              className="flex-1"
              value={selectedTokenId ?? ""}
              onChange={(e) => setSelectedTokenId(Number(e.target.value) || null)}
            >
              <option value="">Selecione um ingresso</option>
              {sellableTickets.map((t) => (
                <option key={t.tokenId} value={t.tokenId}>
                  #{t.ticketNumber} · {t.event.title} (token #{t.tokenId})
                </option>
              ))}
            </SelectField>
            <Button disabled={!selectedTokenId} onClick={() => setListModalOpen(true)}>Continuar</Button>
          </div>
        </Panel>
      )}

      {/* PIX checkout modal */}
      <Modal open={!!checkout} onClose={() => { setCheckout(null); fetchListings(tab); }} title="Pague via PIX">
        {checkout && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">Valor: R$ {checkout.amountBrl.toFixed(2)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={checkout.qrCodeUrl} alt="QR PIX" className="mx-auto h-48 w-48 rounded-lg border border-border" />
            <p className="select-all break-all rounded-lg bg-surface-2 p-3 text-xs text-text">{checkout.pixCode}</p>
            <p className="text-center text-xs text-text-muted">O ingresso será transferido após confirmação do pagamento.</p>
          </div>
        )}
      </Modal>

      {/* Own listing details modal — quebra completa do split, não só o
          líquido (PLANO_EVOLUCAO_V2.md §3.8: mostrar o preço cheio como
          "você recebe" superestimava o repasse em ~18%). */}
      <Modal open={!!details} onClose={() => setDetails(null)} title="Detalhes do anúncio">
        {details && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text">{details.ticket.event.title}</p>
            <p className="text-xs text-text-muted">
              Ingresso #{details.ticket.ticketNumber}{details.ticket.seat ? ` · Assento ${details.ticket.seat}` : ""} · Token #{details.tokenId}
            </p>
            <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-2 p-3 text-sm">
              <div className="flex items-center justify-between text-text-muted">
                <span>Preço anunciado</span>
                <span className="tabular-nums">R$ {details.priceBrl.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <span>Royalty do organizador</span>
                <span className="tabular-nums">− R$ {details.organizerRoyaltyBrl.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <span>Taxa da plataforma</span>
                <span className="tabular-nums">− R$ {details.platformTotalBrl.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 text-text">
                <span className="font-medium">Você recebe</span>
                <span className="text-lg font-bold tabular-nums">R$ {details.sellerReceivesBrl.toFixed(2)}</span>
              </div>
            </div>
            <Button variant="danger" onClick={() => handleCancel(details)}>Cancelar anúncio</Button>
          </div>
        )}
      </Modal>

      {/* Listings */}
      {loading ? (
        <p className="text-text-muted">Carregando…</p>
      ) : listings.length === 0 ? (
        <EmptyState
          icon="ticket"
          title={tab === "collectibles" ? "Nenhum colecionável à venda no momento." : "Nenhum ingresso à venda no momento."}
        />
      ) : tab === "collectibles" ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l, i) => {
            const isMine = !!myAddress && l.sellerAddress.toLowerCase() === myAddress;
            return (
              <CollectibleCard
                key={l.id}
                gradIndex={i}
                coverImageUrl={l.ticket.event.coverImageUrl}
                title={l.ticket.event.title}
                eventDateLabel={new Date(l.ticket.event.eventDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                meta={`${l.ticket.event.venue} · ${l.ticket.event.city} · Ingresso #${l.ticket.ticketNumber}`}
                attended={l.attendedEvent}
              >
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-bold tabular-nums text-text">${l.priceUsdc.toFixed(2)} USDC</span>
                  {isMine ? (
                    <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setDetails(l)}>Detalhes</Button>
                  ) : (
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setProposeTarget(l)}>
                        Propor
                      </Button>
                      <Button size="sm" onClick={() => handleBuy(l)}>
                        {authenticated ? "Comprar" : "Login"}
                      </Button>
                    </div>
                  )}
                </div>
              </CollectibleCard>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {listings.map((l) => {
            const isMine = !!myAddress && l.sellerAddress.toLowerCase() === myAddress;
            return (
              <Panel key={l.id}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-lg text-text">{l.ticket.event.title}</p>
                    {isMine && <Badge variant="info">Seu ingresso</Badge>}
                  </div>
                  <p className="text-xs text-text-muted">
                    {new Date(l.ticket.event.eventDate).toLocaleString("pt-BR")} · {l.ticket.event.venue}, {l.ticket.event.city}
                  </p>
                  <p className="text-xs text-text-muted">
                    Ingresso #{l.ticket.ticketNumber}{l.ticket.seat ? ` · Assento ${l.ticket.seat}` : ""} · Token #{l.tokenId}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="font-bold tabular-nums text-text">${l.priceUsdc.toFixed(2)} USDC</span>
                    <span className="text-sm text-text-muted">≈ R$ {l.priceBrl.toFixed(2)}</span>
                    {isMine ? (
                      <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setDetails(l)}>
                        Detalhes
                      </Button>
                    ) : (
                      <div className="ml-auto flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setProposeTarget(l)}>
                          Fazer proposta
                        </Button>
                        <Button size="sm" onClick={() => handleBuy(l)}>
                          {authenticated ? "Comprar" : "Login para comprar"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Proposta — LAYOUT_UPDATE.md §6.5: modal com o valor proposto e o que
          o vendedor recebe. Só sobre revenda; nunca aparece em /events. */}
      <Modal open={!!proposeTarget} onClose={() => setProposeTarget(null)} title="Fazer proposta">
        {proposeTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              {proposeTarget.ticket.event.title} — anunciado por ${proposeTarget.priceUsdc.toFixed(2)} USDC
            </p>
            <Field
              label="Sua oferta (USDC)"
              type="number"
              step="0.01"
              min="0.01"
              value={proposeAmount}
              onChange={(e) => setProposeAmount(e.target.value)}
            />
            <p className="text-xs text-text-muted">
              O vendedor tem 24h para aceitar, recusar ou contrapropor. Até 3 rodadas.
            </p>
            {proposeMsg && <p className="text-xs text-erro-on-dark">{proposeMsg}</p>}
            <Button onClick={submitProposal} disabled={proposing || !proposeAmount}>
              {proposing ? "Enviando…" : "Enviar proposta"}
            </Button>
          </div>
        )}
      </Modal>

      <ListTicketModal
        open={listModalOpen}
        tokenId={selectedTokenId}
        ticketLabel={
          selectedTicket
            ? `#${selectedTicket.ticketNumber} · ${selectedTicket.event.title} (token #${selectedTicket.tokenId})`
            : ""
        }
        onClose={() => setListModalOpen(false)}
        onListed={() => {
          setSelectedTokenId(null);
          fetchListings(tab);
          fetchMyTickets();
        }}
      />
    </div>
  );
}
