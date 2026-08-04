import { Badge } from "./Badge";

// LAYOUT_UPDATE.md §5.4 — colecionável não é ingresso: sem contagem
// regressiva, disponibilidade ou "expira em". PLANO_EVOLUCAO_V2.md §6.1/D13
// — sem coverImageUrl, usa a arte gerada em vez do gradiente liso de antes.
export function CollectibleCard({
  tokenId,
  coverImageUrl,
  title,
  eventDateLabel,
  meta,
  attended,
  children,
}: {
  tokenId: number;
  coverImageUrl?: string | null;
  title: string;
  eventDateLabel: string;
  meta: string;
  attended: boolean;
  children?: React.ReactNode;
}) {
  const art = coverImageUrl ?? `/api/tickets/${tokenId}/art.svg`;
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          height: 140,
          borderRadius: "var(--radius-arch)",
          backgroundImage: `url(${art})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
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
