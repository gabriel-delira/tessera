import { Icon } from "./Icon";
import { Badge } from "./Badge";

const gradients = ["var(--grad-energia)", "var(--grad-profundidade)", "var(--grad-legado)"];

// LAYOUT_UPDATE.md §5.4 — colecionável não é ingresso: sem contagem
// regressiva, disponibilidade ou "expira em".
export function CollectibleCard({
  gradIndex = 0,
  coverImageUrl,
  title,
  eventDateLabel,
  meta,
  attended,
  children,
}: {
  gradIndex?: number;
  coverImageUrl?: string | null;
  title: string;
  eventDateLabel: string;
  meta: string;
  attended: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          height: 140,
          borderRadius: "var(--radius-arch)",
          background: coverImageUrl ? undefined : gradients[gradIndex % gradients.length],
          backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!coverImageUrl && <Icon name="quadrifolio" className="h-14 w-14 text-ouro-300 opacity-55" />}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(12,19,36,.9), transparent 60%)" }}
        />
        {attended && (
          <span className="absolute right-3 top-3">
            <Badge variant="info" float>Você esteve lá</Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-[18px] pb-[18px] pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ouro-400">{eventDateLabel}</p>
        <h3 className="font-display text-[1.2rem] text-text">{title}</h3>
        <p className="text-sm text-text-muted">{meta}</p>
        {children}
      </div>
    </div>
  );
}
