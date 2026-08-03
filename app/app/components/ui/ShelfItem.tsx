import { Badge } from "./Badge";

const gradients = ["var(--grad-energia)", "var(--grad-profundidade)", "var(--grad-legado)"];

// LAYOUT_UPDATE.md §8.1 — peça de prateleira: capa em arco com o filete Ouro
// do ticket, reaproveitando o gradiente que EventCard/TicketRow já usam.
export function ShelfItem({
  gradIndex = 0,
  coverImageUrl,
  title,
  subtitle,
  frozen = false,
  attended = false,
  onClick,
}: {
  gradIndex?: number;
  coverImageUrl?: string | null;
  title: string;
  subtitle: string;
  frozen?: boolean;
  attended?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-left transition-transform hover:-translate-y-0.5 ${frozen ? "opacity-50" : ""}`}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          height: 110,
          borderRadius: "var(--radius-arch)",
          background: coverImageUrl ? undefined : gradients[gradIndex % gradients.length],
          backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[6px] rounded-md border border-ouro-500/30"
        />
        {attended && (
          <span className="absolute right-2 top-2">
            <Badge variant="info" float>Esteve lá</Badge>
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate font-display text-sm text-text">{title}</p>
        <p className="truncate text-xs text-text-muted">{subtitle}</p>
      </div>
    </button>
  );
}
