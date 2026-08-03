"use client";

import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useAuth } from "@/app/components/AuthProvider";
import { Modal } from "./ui/Modal";
import { Field } from "./ui/Field";
import { Button } from "./ui/Button";
import { IdentityModal } from "./IdentityModal";

interface ListingCalldata {
  approveCalldata: string;
  listTicketCalldata: string;
  nftAddress: string;
  resaleAddress: string;
  listingId: string;
}

// Fluxo único de "colocar ingresso à venda" — extraído de market/page.tsx
// (PLANO_EVOLUCAO_V2.md §3.7). Antes vivia inteiro dentro da tela de Mercado;
// agora Minha Coleção também abre o mesmo modal, e as duas transações
// on-chain (approve + listTicket) só existem escritas num lugar.
export function ListTicketModal({
  open,
  tokenId,
  ticketLabel,
  onClose,
  onListed,
}: {
  open: boolean;
  tokenId: number | null;
  ticketLabel: string;
  onClose: () => void;
  onListed: () => void;
}) {
  const { getAccessToken } = useAuth();
  const { wallets } = useWallets();

  const [priceUsdc, setPriceUsdc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [calldata, setCalldata] = useState<ListingCalldata | null>(null);
  const [txStatus, setTxStatus] = useState("");
  const [needsKyc, setNeedsKyc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reseta o formulário ao (re)abrir — ajuste de estado durante o render em
  // resposta a uma prop mudando, não um efeito, então não dispara o
  // cascading-render que setState-em-effect causaria.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPriceUsdc("");
      setSubmitting(false);
      setCalldata(null);
      setTxStatus("");
      setError(null);
    }
  }

  const submitPrice = async () => {
    if (!tokenId || !priceUsdc) return;
    setSubmitting(true);
    setError(null);
    const token = await getAccessToken();
    const r = await fetch("/api/listings", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId, priceUsdc: parseFloat(priceUsdc) }),
    });
    const data = await r.json();
    if (!r.ok) {
      if (data.code === "KYC_REQUIRED") { setNeedsKyc(true); setSubmitting(false); return; }
      setError(data.error ?? "Erro ao criar listagem");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setCalldata({ ...data });
  };

  const signAndList = async () => {
    if (!calldata) return;
    const { approveCalldata, listTicketCalldata, nftAddress, resaleAddress, listingId } = calldata;
    const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
    if (!embeddedWallet) { setError("Carteira Privy não encontrada"); return; }

    setTxStatus("Enviando approve…");
    try {
      // Privy 3.x removeu sendTransaction do objeto wallet — a via atual é
      // pegar o provider EIP-1193 e chamar eth_sendTransaction diretamente.
      const provider = await embeddedWallet.getEthereumProvider();
      await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: embeddedWallet.address, to: nftAddress, data: approveCalldata }],
      });
      setTxStatus("Approve confirmado. Enviando listTicket…");
      const listTxHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: embeddedWallet.address, to: resaleAddress, data: listTicketCalldata }],
      });

      // Confirma pro backend extrair o onchainListingId
      const token = await getAccessToken();
      await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: listTxHash }),
      });

      setTxStatus("Ingresso listado com sucesso!");
      onListed();
      onClose();
    } catch (err) {
      setTxStatus(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Anunciar ingresso">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">{ticketLabel}</p>
          {!calldata ? (
            <>
              <Field
                label="Preço em USDC"
                type="number"
                min="0.01"
                step="0.01"
                value={priceUsdc}
                onChange={(e) => setPriceUsdc(e.target.value)}
              />
              {error && <p className="text-xs text-erro-on-dark">{error}</p>}
              <Button onClick={submitPrice} disabled={submitting || !priceUsdc}>
                {submitting ? "Aguarde…" : "Continuar"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-text-muted">
                Pronto! Confirme as duas transações na sua carteira para colocar o ingresso à venda.
              </p>
              <Button onClick={signAndList} className="self-start">Assinar e Listar</Button>
              {txStatus && <p className="text-xs text-text-muted">{txStatus}</p>}
            </>
          )}
        </div>
      </Modal>

      <IdentityModal
        open={needsKyc}
        mode="verify"
        onClose={() => setNeedsKyc(false)}
        onDone={() => { setNeedsKyc(false); submitPrice(); }}
      />
    </>
  );
}
