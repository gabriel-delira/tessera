const gradients = ["var(--grad-energia)", "var(--grad-profundidade)", "var(--grad-legado)"];

export function TicketRow({
  thumbGrad = 0,
  title,
  subtitle,
  frozen = false,
  badge,
  actions,
}: {
  thumbGrad?: number;
  title: string;
  subtitle: string;
  frozen?: boolean;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex items-center gap-[18px] rounded-lg border border-border bg-surface p-[18px] ${
        frozen ? "opacity-50" : ""
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[7px] rounded-md border border-ouro-500/30"
      />
      <div
        className="h-[76px] w-[76px] shrink-0"
        style={{ background: gradients[thumbGrad % gradients.length], borderRadius: "var(--radius-arch)" }}
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-lg text-text">{title}</h3>
        <p className="text-sm text-text-muted">{subtitle}</p>
        {badge && <div className="mt-1.5">{badge}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
    </div>
  );
}
