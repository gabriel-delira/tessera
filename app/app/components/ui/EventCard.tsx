import Link from "next/link";
import { Icon, type IconName } from "./Icon";
import { Badge } from "./Badge";

const gradients = ["var(--grad-energia)", "var(--grad-profundidade)", "var(--grad-legado)"];

// Barra de disponibilidade — PLANO_EVOLUCAO_V2.md §8. Sem vermelho: o
// DESIGN_SYSTEM.md deriva as cores de estado evitando vermelhos saturados
// que brigam com Laranja e Ouro, e escassez não é erro. A escala termina em
// Violeta (cor de marca, tom claro e chamativo) em vez disso.
function scarcityColorClass(availablePct: number): string {
  if (availablePct < 20) return "bg-violeta-300";
  if (availablePct < 50) return "bg-laranja-400";
  return "bg-ouro-500";
}

export function EventCard({
  href,
  coverImageUrl,
  fallbackIcon = "quadrifolio",
  gradIndex = 0,
  day,
  month,
  badge,
  category,
  title,
  meta,
  availableLabel,
  availablePct,
  priceLabel,
  price,
  cta,
  compact = false,
}: {
  href: string;
  coverImageUrl?: string | null;
  fallbackIcon?: IconName;
  gradIndex?: number;
  day: string;
  month: string;
  badge?: { label: string; variant: "success" | "error" | "warning" | "info" | "neutral" };
  category: string;
  title: string;
  meta: string;
  availableLabel?: string;
  availablePct?: number;
  priceLabel?: string;
  price: string;
  cta: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-ouro-500/40 hover:shadow-lg ${
        compact ? "w-64" : ""
      }`}
    >
      <span className="absolute left-3 top-3 z-10 flex flex-col items-center rounded-md bg-noite-900/82 px-2.5 py-1.5 text-center leading-none text-text">
        <b className="text-base">{day}</b>
        <span className="text-[10px] uppercase tracking-[0.1em] text-ouro-400">{month}</span>
      </span>
      {badge && (
        <span className="absolute right-3 top-3 z-10">
          <Badge variant={badge.variant} float>
            {badge.label}
          </Badge>
        </span>
      )}
      <div
        className="relative flex items-center justify-center overflow-hidden bg-cover bg-center"
        style={{
          height: compact ? 100 : 168,
          borderRadius: "var(--radius-arch)",
          background: coverImageUrl ? undefined : gradients[gradIndex % gradients.length],
          backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!coverImageUrl && (
          <Icon name={fallbackIcon} className={compact ? "h-10 w-10 text-ouro-300 opacity-55" : "h-[68px] w-[68px] text-ouro-300 opacity-55"} />
        )}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(12,19,36,.9), transparent 60%)" }}
        />
      </div>
      <div className={`flex flex-1 flex-col gap-1.5 ${compact ? "px-3 pb-3 pt-2" : "px-[18px] pb-[18px] pt-3"}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ouro-400">{category}</p>
        <h3 className={compact ? "font-display text-base text-text" : "font-display text-[1.3125rem] text-text"}>{title}</h3>
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <Icon name="local" />
          {meta}
        </p>
        {!compact && availablePct !== undefined && (
          <div className="mt-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span
                className={`block h-full rounded-full ${scarcityColorClass(availablePct)}`}
                style={{ width: `${Math.min(100, Math.max(0, availablePct))}%` }}
              />
            </div>
            {availableLabel && <p className="mt-1 text-xs text-text-muted">{availableLabel}</p>}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="leading-tight">
            {priceLabel && <small className="block text-[11px] text-text-muted">{priceLabel}</small>}
            <span className="font-sans text-lg font-bold tabular-nums text-text">{price}</span>
          </div>
          <span className="inline-flex h-9 items-center justify-center rounded-md border border-border-strong px-4 text-sm font-semibold text-text group-hover:border-ouro-500">
            {cta}
          </span>
        </div>
      </div>
    </Link>
  );
}
