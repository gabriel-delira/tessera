import { Button } from "./Button";

// LAYOUT_UPDATE.md §7.3 — acima e visualmente separado da lista: não é item
// de coleção, é dinheiro. StatCard como base (filete --grad-energia já dá o
// destaque certo).
export function BalanceCard({
  balanceBrl,
  onWithdraw,
}: {
  balanceBrl: number;
  onWithdraw: () => void;
}) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-lg border border-border bg-surface p-[18px]">
      <span className="absolute inset-x-0 top-0 h-[3px] [background:var(--grad-energia)]" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Saldo disponível</p>
          <p className="mt-1.5 font-sans text-[28px] font-bold tabular-nums text-text">
            R$ {balanceBrl.toFixed(2).replace(".", ",")}
          </p>
        </div>
        <Button size="sm" onClick={onWithdraw} disabled={balanceBrl <= 0}>
          Sacar via PIX
        </Button>
      </div>
    </div>
  );
}
