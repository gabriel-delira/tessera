export function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-[18px]">
      <span className="absolute inset-x-0 top-0 h-[3px] [background:var(--grad-energia)]" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="mt-1.5 font-sans text-[26px] font-bold tabular-nums text-text">{value}</p>
      {delta && <p className="mt-1 text-xs text-sucesso-on-dark">{delta}</p>}
    </div>
  );
}
