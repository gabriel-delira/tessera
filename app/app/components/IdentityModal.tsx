"use client";

import { useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import { Modal } from "./ui/Modal";
import { Field } from "./ui/Field";
import { Button } from "./ui/Button";

// LAYOUT_UPDATE.md §5.6.1 — coleta o nível de identificação certo na hora
// certa: CPF (identify) antes da 1a compra, KYC completo (verify) antes do
// 1o anúncio de revenda. Nunca pede mais do que o passo exige.
export function IdentityModal({
  open,
  mode,
  onClose,
  onDone,
}: {
  open: boolean;
  mode: "identify" | "verify";
  onClose: () => void;
  onDone: () => void;
}) {
  const { getAccessToken } = useAuth();
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const token = await getAccessToken();
    const url = mode === "identify" ? "/api/me/identify" : "/api/me/verify";
    const body = mode === "identify" ? { cpf } : { cpf, fullName };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    setSubmitting(false);
    if (!r.ok) { setError(d.error ?? "Erro ao verificar"); return; }
    setCpf("");
    setFullName("");
    onDone();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "identify" ? "Confirme seu CPF" : "Verificação de identidade"}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          {mode === "identify"
            ? "Pedimos o CPF antes da primeira compra — é o mesmo dado usado no controle de meia-entrada e limite por comprador."
            : "Antes do primeiro anúncio de revenda, confirmamos sua identidade — é exigido apenas de quem vai receber dinheiro."}
        </p>
        <Field
          label="CPF"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
        />
        {mode === "verify" && (
          <Field
            label="Nome completo"
            placeholder="Como está no documento"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        )}
        {error && <p className="text-xs text-erro-on-dark">{error}</p>}
        <Button onClick={submit} disabled={submitting || !cpf || (mode === "verify" && !fullName)}>
          {submitting ? "Verificando…" : "Confirmar"}
        </Button>
      </div>
    </Modal>
  );
}
