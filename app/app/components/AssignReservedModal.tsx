"use client";

import { useEffect, useState } from "react";
import { Modal } from "./ui/Modal";
import { Field } from "./ui/Field";
import { Button } from "./ui/Button";

interface CheckoutState {
  purchaseId: string;
  pixCode: string;
  qrCodeUrl: string;
  amountBrl: number;
}

// Atribuir uma unidade da cota reservada do evento a um beneficiário —
// PLANO_EVOLUCAO_V2.md §5.4/D19. Reusa o checkout normal (POST
// /api/events/[id]/checkout com useReservedAllocation:true): o organizador
// paga o preço cheio via PIX como qualquer comprador — "só paga a taxa da
// plataforma" acontece em termos líquidos, porque a parte dele volta como
// payout do próprio evento. Ver o comentário na rota de checkout.
export function AssignReservedModal({
  open,
  eventId,
  eventTitle,
  onClose,
  onAssigned,
  authFetch,
}: {
  open: boolean;
  eventId: string | null;
  eventTitle: string;
  onClose: () => void;
  onAssigned: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}) {
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRecipient("");
      setSubmitting(false);
      setError(null);
      setCheckout(null);
      setStatus(null);
    }
  }

  useEffect(() => {
    if (!checkout || status === "COMPLETED") return;
    const interval = setInterval(async () => {
      const r = await authFetch(`/api/purchases/${checkout.purchaseId}`);
      if (!r.ok) return;
      const d = await r.json();
      setStatus(d.status);
      if (d.status === "COMPLETED") onAssigned();
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout, status]);

  const submit = async () => {
    if (!eventId || !recipient) return;
    setSubmitting(true);
    setError(null);
    const r = await authFetch(`/api/events/${eventId}/checkout`, {
      method: "POST",
      body: JSON.stringify({ method: "PIX", giftRecipient: recipient, useReservedAllocation: true }),
    });
    const d = await r.json();
    setSubmitting(false);
    if (!r.ok) { setError(d.error ?? "Erro ao atribuir ingresso reservado"); return; }
    setCheckout({ purchaseId: d.purchaseId, pixCode: d.pixCode, qrCodeUrl: d.qrCodeUrl, amountBrl: d.amountBrl });
    setStatus("PENDING");
  };

  return (
    <Modal open={open} onClose={onClose} title="Atribuir ingresso reservado">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">{eventTitle}</p>
        {!checkout ? (
          <>
            <Field
              label="E-mail ou CPF do beneficiário"
              placeholder="Precisa já ter conta na Tessera"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            {error && <p className="text-xs text-erro-on-dark">{error}</p>}
            <Button onClick={submit} disabled={submitting || !recipient}>
              {submitting ? "Aguarde…" : "Continuar"}
            </Button>
          </>
        ) : status === "COMPLETED" ? (
          <p className="text-sm text-sucesso-on-dark">Ingresso atribuído com sucesso!</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">Valor: R$ {checkout.amountBrl.toFixed(2)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={checkout.qrCodeUrl} alt="QR PIX" className="mx-auto h-48 w-48 rounded-lg border border-border" />
            <p className="select-all break-all rounded-lg bg-surface-2 p-3 text-xs text-text">{checkout.pixCode}</p>
            <p className="text-center text-xs text-text-muted">Status: {status}</p>
            {process.env.NODE_ENV !== "production" && (
              <button
                onClick={() => authFetch(`/api/dev/simulate-payment/${checkout.purchaseId}`, { method: "POST" })}
                className="text-xs text-violeta-300 underline"
              >
                [DEV] Simular pagamento
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
