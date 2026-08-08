"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "./ui/Modal";
import { Field } from "./ui/Field";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";

interface AccessCodeRow {
  id: string;
  code: string;
  label: string | null;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  scannedAt: string | null;
}

// Formata "4K7P9XQ2M3" -> "4K7P-9XQ2-M3", só pra leitura — o valor
// persistido/enviado ao servidor é sempre a string crua.
function formatCode(code: string): string {
  return code.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}

// Gerar, listar, copiar e revogar códigos de entrada — PLANO_EVOLUCAO_V2.md
// §10.5-10.6/D41-D43. Entrada avulsa sem NFT, gerada depois da criação do
// evento (não compete com a reserva, que dá ingresso + colecionável).
export function AccessCodesModal({
  open,
  eventId,
  eventTitle,
  onClose,
  authFetch,
}: {
  open: boolean;
  eventId: string | null;
  eventTitle: string;
  onClose: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}) {
  const [codes, setCodes] = useState<AccessCodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState("10");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const r = await authFetch(`/api/organizer/events/${eventId}/access-codes`);
    if (r.ok) { const d = await r.json(); setCodes(d.codes ?? []); }
    setLoading(false);
  }, [eventId, authFetch]);

  useEffect(() => {
    if (open) { load(); setError(null); setLabel(""); setCount("10"); }
  }, [open, load]);

  const generate = async () => {
    if (!eventId) return;
    const n = parseInt(count, 10);
    if (!Number.isInteger(n) || n < 1) { setError("Informe uma quantidade válida."); return; }
    setSubmitting(true);
    setError(null);
    const r = await authFetch(`/api/organizer/events/${eventId}/access-codes`, {
      method: "POST",
      body: JSON.stringify({ count: n, label: label || undefined }),
    });
    const d = await r.json();
    setSubmitting(false);
    if (!r.ok) { setError(d.error ?? "Erro ao gerar códigos"); return; }
    setLabel("");
    load();
  };

  const revoke = async (codeId: string) => {
    if (!eventId) return;
    setRevokingId(codeId);
    const r = await authFetch(`/api/organizer/events/${eventId}/access-codes/${codeId}`, { method: "DELETE" });
    setRevokingId(null);
    if (r.ok) load();
  };

  const pending = codes.filter((c) => !c.usedAt && !c.revokedAt);

  return (
    <Modal open={open} onClose={onClose} title="Códigos de entrada" size="large">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          {eventTitle} — dá só entrada, sem colecionável. Pra presentear com ingresso e figurinha,
          use &quot;Atribuir&quot; na coluna Reservados.
        </p>

        <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-end">
          <Field
            label="Quantidade"
            type="number"
            min="1"
            max="100"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="sm:w-32"
          />
          <Field
            label="Identificação (opcional)"
            placeholder="Imprensa, staff…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1"
          />
          <Button onClick={generate} disabled={submitting}>
            {submitting ? "Gerando…" : "Gerar"}
          </Button>
        </div>
        {error && <p className="text-xs text-erro-on-dark">{error}</p>}

        {loading ? (
          <p className="text-sm text-text-muted">Carregando…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum código gerado ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-text-muted">{pending.length} pendente(s) de {codes.length} total</p>
            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {codes.map((c) => {
                    const status = c.revokedAt ? "Revogado" : c.usedAt ? "Usado" : "Pendente";
                    const variant = c.revokedAt ? "neutral" : c.usedAt ? "info" : "success";
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-text">{formatCode(c.code)}</td>
                        <td className="px-3 py-2 text-text-muted">{c.label ?? "—"}</td>
                        <td className="px-3 py-2"><Badge variant={variant}>{status}</Badge></td>
                        <td className="px-3 py-2 text-right">
                          {!c.usedAt && !c.revokedAt && (
                            <button
                              onClick={() => revoke(c.id)}
                              disabled={revokingId === c.id}
                              className="text-xs text-erro-on-dark underline disabled:opacity-50"
                            >
                              {revokingId === c.id ? "Revogando…" : "Revogar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
