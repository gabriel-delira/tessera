"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { Icon, type IconName } from "../components/ui/Icon";
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
  createdAt: string;
  isCollectible: boolean;
  attendedEvent: boolean;
  sellerReceivesBrl: number;
  organizerRoyaltyBrl: number;
  platformTotalBrl: number;
  sellerAchievements: { id: string; icon: string; title: string }[] | null;
  sellerAchievementsHash: string | null;
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
      maxResaleBps: number | null;
    };
  };
}

interface NegotiationRoundView {
  roundNumber: number;
  author: "BUYER" | "SELLER";
  priceUsdc: number;
  createdAt: string;
}

interface NegotiationView {
  id: string;
  listingId: string;
  status: "OPEN" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "SUPERSEDED";
  agreedPrice: number | null;
  rounds: NegotiationRoundView[];
}

interface ListingAnalytics {
  negotiations: NegotiationView[];
  checkoutAttempts: number;
  unsuccessfulCheckouts: number;
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

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "há poucos minutos";
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

// useSearchParams (deep link do slot vazio no álbum — §6.2/D15) exige um
// Suspense boundary pra não bloquear o prerender estático da página inteira.
export default function MarketPage() {
  return (
    <Suspense fallback={null}>
      <MarketPageInner />
    </Suspense>
  );
}

function MarketPageInner() {
  const { ready, authenticated, login, getAccessToken, walletAddress } = useAuth();
  const searchParams = useSearchParams();

  // Deep link do álbum (CollectionShelf) pro slot vazio de uma coleção —
  // PLANO_EVOLUCAO_V2.md §6.2/D15. Só lido na primeira render, igual a um
  // valor inicial de useState — trocar de aba depois é livre, sem sincronizar
  // de volta pra URL.
  const [tab, setTab] = useState<MarketTab>(searchParams.get("tab") === "collectibles" ? "collectibles" : "tickets");
  // Deep link do card "Ver revenda" de um evento esgotado — §9.2/D29. Só lido
  // na primeira render, igual ao `tab` acima; o chip permite limpar o filtro
  // sem sincronizar de volta pra URL.
  const [eventFilter, setEventFilter] = useState<{ id: string; title: string } | null>(null);
  const [listings, setListings]   = useState<MarketListing[]>([]);
  const [myTickets, setMyTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading]     = useState(true);
  const [checkout, setCheckout]   = useState<CheckoutState | null>(null);
  const [details, setDetails]     = useState<MarketListing | null>(null);
  const [detailsAnalytics, setDetailsAnalytics] = useState<ListingAnalytics | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [proposeTarget, setProposeTarget] = useState<MarketListing | null>(null);
  const [proposeAmount, setProposeAmount] = useState("");
  const [proposeMsg, setProposeMsg] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);

  const myAddress = walletAddress;

  const fetchListings = useCallback(async (t: MarketTab, eventId?: string) => {
    setLoading(true);
    const qs = eventId ? `tab=${t}&event=${eventId}` : `tab=${t}`;
    const r = await fetch(`/api/market?${qs}`);
    const data = await r.json();
    setListings(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  // Carrega o título do evento filtrado (deep link §9.2/D29) uma vez, pro chip.
  useEffect(() => {
    const eventId = searchParams.get("event");
    if (!eventId) return;
    fetch(`/api/events/${eventId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.title) setEventFilter({ id: eventId, title: d.title }); })
      .catch(() => {});
  }, [searchParams]);

  const fetchMyTickets = useCallback(async () => {
    if (!authenticated) return;
    const token = await getAccessToken();
    const r = await fetch("/api/me/tickets", { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    setMyTickets(Array.isArray(data) ? data : []);
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    fetchListings(tab, eventFilter?.id);
    if (authenticated) fetchMyTickets();
  }, [ready, authenticated, tab, eventFilter, fetchListings, fetchMyTickets]);

  const clearEventFilter = () => {
    setEventFilter(null);
    fetchListings(tab);
  };

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

  // Detalhes do anúncio — PLANO_EVOLUCAO_V2.md §4.2. Duas fontes: negociações
  // (endpoint que já existe, filtrado por esse listingId) e a analytics de
  // checkout (endpoint novo, camada 2). Carregado só ao abrir, não pra cada
  // card da lista.
  const openDetails = async (listing: MarketListing) => {
    setDetails(listing);
    setDetailsAnalytics(null);
    const token = await getAccessToken();
    const [negRes, listingRes] = await Promise.all([
      fetch("/api/negotiations", { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/listings/${listing.id}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const negotiations: NegotiationView[] = negRes.ok
      ? ((await negRes.json()).asSeller ?? []).filter((n: NegotiationView) => n.listingId === listing.id)
      : [];
    const { checkoutAttempts, unsuccessfulCheckouts } = listingRes.ok
      ? await listingRes.json()
      : { checkoutAttempts: 0, unsuccessfulCheckouts: 0 };
    setDetailsAnalytics({ negotiations, checkoutAttempts, unsuccessfulCheckouts });
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <PageTitle subtitle="Ingressos e colecionáveis entre pessoas.">Revenda</PageTitle>

      {eventFilter && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-text-muted">Filtrando:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-text">
            {eventFilter.title}
            <button
              type="button"
              onClick={clearEventFilter}
              aria-label="Limpar filtro de evento"
              className="text-text-muted hover:text-text"
            >
              ✕
            </button>
          </span>
        </div>
      )}

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
            <p className="text-xs text-text-muted">
              Anunciado {timeAgo(details.createdAt)}
              {details.ticket.event.maxResaleBps !== null && (
                <> · Teto de revenda: {(details.ticket.event.maxResaleBps / 100).toFixed(0)}% do preço original</>
              )}
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

            {/* Analytics — PLANO_EVOLUCAO_V2.md §4.2. Camada 1 (propostas) e
                camada 2 (tentativas de checkout), sem tabela nova pra views. */}
            {!detailsAnalytics ? (
              <p className="text-xs text-text-muted">Carregando estatísticas…</p>
            ) : (
              <div className="flex flex-col gap-3 rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between text-text-muted">
                  <span>Tentativas de compra</span>
                  <span className="tabular-nums text-text">{detailsAnalytics.checkoutAttempts}</span>
                </div>
                <div className="flex items-center justify-between text-text-muted">
                  <span>Sem sucesso (expirou/falhou)</span>
                  <span className="tabular-nums text-text">{detailsAnalytics.unsuccessfulCheckouts}</span>
                </div>
                {detailsAnalytics.negotiations.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-border pt-2">
                    <span className="text-text-muted">Propostas recebidas</span>
                    {detailsAnalytics.negotiations.map((n) => {
                      const last = n.rounds[n.rounds.length - 1];
                      return (
                        <div key={n.id} className="flex items-center justify-between text-xs">
                          <span className="text-text-muted">
                            {last ? `$${last.priceUsdc.toFixed(2)} USDC` : "—"} · {n.rounds.length} rodada{n.rounds.length > 1 ? "s" : ""}
                          </span>
                          <Badge
                            variant={
                              n.status === "ACCEPTED" ? "success" : n.status === "OPEN" ? "warning" : "neutral"
                            }
                          >
                            {n.status === "OPEN" ? "Em aberto" : n.status === "ACCEPTED" ? "Aceita" : n.status === "DECLINED" ? "Recusada" : n.status === "EXPIRED" ? "Expirada" : "Superada"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
          title={
            eventFilter
              ? `Ninguém está revendendo ingresso para ${eventFilter.title} ainda.`
              : tab === "collectibles"
              ? "Nenhum colecionável à venda no momento."
              : "Nenhum ingresso à venda no momento."
          }
        />
      ) : tab === "collectibles" ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => {
            const isMine = !!myAddress && l.sellerAddress.toLowerCase() === myAddress;
            return (
              <CollectibleCard
                key={l.id}
                tokenId={l.tokenId}
                coverImageUrl={l.ticket.event.coverImageUrl}
                title={l.ticket.event.title}
                eventDateLabel={new Date(l.ticket.event.eventDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                meta={`${l.ticket.event.venue} · ${l.ticket.event.city}`}
                attended={l.attendedEvent}
              >
                {/* §9.3/D30 — meta some pra 2 linhas fixas (local / nº do
                    ingresso) em vez de uma string só, senão card vizinho
                    quebra em alturas diferentes. */}
                <p className="-mt-1 text-xs text-text-muted">Ingresso #{l.ticket.ticketNumber}</p>

                {/* Troféus com prova — PLANO_EVOLUCAO_V2.md §6.3/D16. Hash é
                    recomputável por qualquer um a partir de dados públicos
                    (checkins do vendedor); não é gravado on-chain nesta fatia. */}
                {l.sellerAchievements && l.sellerAchievements.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5" title={`Prova: ${l.sellerAchievementsHash}`}>
                    {l.sellerAchievements.map((a) => (
                      <Icon key={a.id} name={a.icon as IconName} className="h-4 w-4 shrink-0 text-ouro-400" />
                    ))}
                    <span className="text-[11px] text-text-muted">troféus do vendedor · com prova</span>
                  </div>
                )}

                {/* §9.3/D30 — preço e ações em duas linhas: o rodapé de uma
                    linha só (preço + Propor + Comprar) não cabe na coluna do
                    grid de 3 e era cortado pelo overflow-hidden do card. */}
                <div className="mt-2 flex min-w-0 flex-col gap-2">
                  <div className="leading-tight">
                    <span className="block truncate font-bold tabular-nums text-text">${l.priceUsdc.toFixed(2)} USDC</span>
                    <span className="text-xs text-text-muted">≈ R$ {l.priceBrl.toFixed(2)}</span>
                  </div>
                  {isMine ? (
                    <Button size="sm" variant="secondary" onClick={() => openDetails(l)}>Detalhes</Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
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
                      <Button size="sm" variant="secondary" className="ml-auto" onClick={() => openDetails(l)}>
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
