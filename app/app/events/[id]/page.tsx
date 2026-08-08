"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";
import Link from "next/link";
import { Panel } from "../../components/ui/Panel";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Icon } from "../../components/ui/Icon";
import { IdentityModal } from "../../components/IdentityModal";
import { Field } from "../../components/ui/Field";

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  venue: string;
  city: string;
  coverImageUrl: string | null;
  eventDate: string;
  ticketPriceUsdc: number;
  ticketPriceBrl: number;
  platformFeeBps: number;
  maxTickets: number | null;
  soldCount: number;
  available: number | null;
  status: string;
  organizer: string;
}

interface CheckoutState {
  purchaseId: string;
  pixCode: string;
  qrCodeUrl: string;
  amountBrl: number;
  expiresAt: string;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ready, authenticated, login, getAccessToken } = useAuth();
  const [event, setEvent]           = useState<EventDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [checkout, setCheckout]     = useState<CheckoutState | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState<string | null>(null);
  const [buying, setBuying]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState("");

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((d) => { setEvent(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  // Poll purchase status after checkout
  useEffect(() => {
    if (!checkout || purchaseStatus === "COMPLETED" || purchaseStatus === "REFUNDED") return;
    const interval = setInterval(async () => {
      const token = await getAccessToken();
      const r = await fetch(`/api/purchases/${checkout.purchaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setPurchaseStatus(d.status);
    }, 2000);
    return () => clearInterval(interval);
  }, [checkout, purchaseStatus, getAccessToken]);

  const handleBuy = async () => {
    if (!authenticated) { login(); return; }
    setBuying(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const r = await fetch(`/api/events/${id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ method: "PIX", giftRecipient: giftRecipient || undefined }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.code === "IDENTIFICATION_REQUIRED") { setNeedsIdentity(true); return; }
        throw new Error(d.error ?? "Erro ao criar cobrança");
      }
      setCheckout(d);
      setPurchaseStatus("PENDING");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setBuying(false);
    }
  };

  if (loading) return <div className="p-10 text-text-muted">Carregando…</div>;
  if (!event)  return <div className="p-10 text-erro-on-dark">Evento não encontrado.</div>;

  const soldOut = event.available !== null && event.available <= 0;
  const feePercent = (event.platformFeeBps / 100).toFixed(0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="mb-4 inline-block text-sm text-text-muted hover:text-text">← Voltar</Link>

      <div
        className="relative mb-6 flex h-64 items-center overflow-hidden rounded-xl"
        style={{
          background: event.coverImageUrl ? undefined : "var(--grad-energia)",
          backgroundImage: event.coverImageUrl ? `url(${event.coverImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!event.coverImageUrl && (
          <Icon name="portal" className="absolute right-6 h-32 w-32 text-ouro-300 opacity-25" />
        )}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(12,19,36,.9), transparent 60%)" }}
        />
        <div className="relative z-10 px-8">
          <h1 className="font-display text-3xl text-text">{event.title}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
            <Icon name="calendario" />
            {new Date(event.eventDate).toLocaleString("pt-BR")} · {event.venue}, {event.city}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Info */}
        <div className="flex flex-1 flex-col gap-4">
          <Panel title="Sobre o evento">
            <p className="mb-3 flex items-center gap-1.5 text-sm text-text-muted">
              <Icon name="escudo" />
              Organizado por {event.organizer}
            </p>
            {event.description && (
              <p className="text-sm leading-relaxed text-text">{event.description}</p>
            )}
            {event.maxTickets && (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-text-muted">
                <Icon name="ticket" />
                Disponíveis: {event.available ?? "?"}/{event.maxTickets}
              </p>
            )}
          </Panel>
        </div>

        {/* Purchase box */}
        <div className="w-full shrink-0 md:w-72">
          <Panel title="Comprar ingresso">
            {!checkout ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-2xl font-bold tabular-nums text-text">
                    R$ {event.ticketPriceBrl.toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-xs text-text-muted">≈ {event.ticketPriceUsdc} USDC</p>
                </div>
                <p className="text-xs text-text-muted">Taxa de serviço {feePercent}% inclusa</p>
                {soldOut ? (
                  <div className="flex flex-col gap-3">
                    <Badge variant="error">Esgotado</Badge>
                    <Link href={`/revenda?tab=tickets&event=${event.id}`}>
                      <Button variant="secondary" className="w-full">Ver na revenda</Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    {authenticated && (
                      <Field
                        label="Presentear alguém? (opcional)"
                        placeholder="E-mail ou CPF de quem já tem conta"
                        value={giftRecipient}
                        onChange={(e) => setGiftRecipient(e.target.value)}
                      />
                    )}
                    <Button onClick={handleBuy} disabled={buying || !ready} className="w-full">
                      {buying ? "Aguarde…" : authenticated ? (giftRecipient ? "Comprar de presente" : "Comprar ingresso") : "Entrar e comprar"}
                    </Button>
                  </>
                )}
                {error && <p className="text-xs text-erro-on-dark">{error}</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {purchaseStatus === "COMPLETED" ? (
                  <div className="text-center">
                    <Icon name="check" className="mx-auto h-8 w-8 text-sucesso-on-dark" />
                    <p className="mt-1 font-semibold text-text">Ingresso é seu!</p>
                    <p className="mt-1 text-xs text-text-muted">NFT mintado com sucesso.</p>
                  </div>
                ) : purchaseStatus === "REFUNDED" ? (
                  <div className="text-center">
                    <p className="font-semibold text-erro-on-dark">Pagamento estornado</p>
                    <p className="mt-1 text-xs text-text-muted">Erro ao processar. Tente novamente.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-text">Pague via PIX</p>
                    <p className="text-xs text-text-muted">
                      R$ {checkout.amountBrl.toFixed(2).replace(".", ",")} · expira às{" "}
                      {new Date(checkout.expiresAt).toLocaleTimeString("pt-BR")}
                    </p>
                    {checkout.qrCodeUrl && (
                      <img src={checkout.qrCodeUrl} alt="QR PIX" className="mx-auto w-40 rounded" />
                    )}
                    <button
                      onClick={() => navigator.clipboard.writeText(checkout.pixCode)}
                      className="text-xs text-text-muted underline"
                    >
                      Copiar código PIX
                    </button>
                    <p className="text-center text-xs text-text-muted">
                      Status: <span className="font-medium text-text">{purchaseStatus}</span>
                    </p>
                    {process.env.NODE_ENV !== "production" && (
                      <button
                        onClick={async () => {
                          const token = await getAccessToken();
                          await fetch(`/api/dev/simulate-payment/${checkout.purchaseId}`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                        }}
                        className="text-xs text-violeta-300 underline"
                      >
                        [DEV] Simular pagamento
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <IdentityModal
        open={needsIdentity}
        mode="identify"
        onClose={() => setNeedsIdentity(false)}
        onDone={() => { setNeedsIdentity(false); handleBuy(); }}
      />
    </div>
  );
}
