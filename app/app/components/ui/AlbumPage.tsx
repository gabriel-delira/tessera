// PLANO_EVOLUCAO_V2.md §9.4.2 — a folha do álbum. Decisão pragmática em cima
// de A9 (aberta no plano): em vez de altura fixa (que corta coleção grande
// ou sobra vazio em coleção pequena), usa min-height generosa — a folha
// cresce com o conteúdo em vez de escondê-lo atrás de overflow-hidden.
export function AlbumPage({
  title,
  countLabel,
  children,
}: {
  title: string;
  countLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-[440px] flex-col overflow-hidden rounded-xl border border-border bg-surface p-6 sm:p-8">
      {/* Vinco da lombada — a folha lê como página de livro aberto, não como
          card solto: sombra suave dos dois lados do meio + o filete do vinco. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(6,11,22,.22) 0%, transparent 12%, transparent 44%, rgba(6,11,22,.38) 50%, transparent 56%, transparent 88%, rgba(6,11,22,.22) 100%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(250,247,242,.10) 12%, rgba(250,247,242,.10) 88%, transparent)",
        }}
      />

      <div className="relative mb-5 flex items-baseline gap-2">
        <h3 className="font-display text-xl text-text">{title}</h3>
        {countLabel && <span className="text-xs text-text-muted">{countLabel}</span>}
      </div>
      <div className="relative flex-1">{children}</div>
    </div>
  );
}
