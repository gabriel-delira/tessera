"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlbumPage } from "./AlbumPage";
import type { CollectionView } from "./CollectionShelf";
import { ShelfItem } from "./ShelfItem";

export interface AlbumTicket {
  tokenId: number;
  eventId: string;
  status: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  coverImageUrl: string | null;
  attended: boolean;
}

type Page =
  | { kind: "year"; year: number; tickets: AlbumTicket[] }
  | { kind: "loose"; tickets: AlbumTicket[] };

function pageSlug(p: Page): string {
  switch (p.kind) {
    case "year": return `ano-${p.year}`;
    case "loose": return "soltas";
  }
}

function pageMeta(p: Page): { title: string; countLabel?: string } {
  switch (p.kind) {
    case "year": return { title: String(p.year) };
    case "loose": return { title: "Ainda por vir" };
  }
}

function TicketGrid({ tickets, onSelect }: { tickets: AlbumTicket[]; onSelect: (tokenId: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {tickets.map((t) => {
        const frozen = !["VALID", "CHECKED_IN"].includes(t.status);
        return (
          <ShelfItem
            key={t.tokenId}
            tokenId={t.tokenId}
            coverImageUrl={t.coverImageUrl}
            title={t.eventTitle}
            subtitle={`${new Date(t.eventDate).toLocaleDateString("pt-BR")} · ${t.city}`}
            frozen={frozen}
            attended={t.attended}
            onClick={() => onSelect(t.tokenId)}
          />
        );
      })}
    </div>
  );
}

// A meia-folha que vira é fatiada em tiras verticais; cada uma roda com um
// atraso crescente a partir da ponta (a ponta "puxada" sai primeiro, o resto
// acompanha) — é esse defasamento que curva o papel. Os keyframes vivem em
// globals.css: encadear as fases em setState travava, porque cada re-render
// reiniciava a transição no meio do movimento.
const STRIPS = 6;
const SWING_MS = 420;
const STAGGER_MS = 34;
const TURN_MS = SWING_MS + STAGGER_MS * (STRIPS - 1);

// PLANO_EVOLUCAO_V2.md §9.4 — álbum de figurinhas paginado, uma página por
// vez, no lugar da pilha de grades empilhadas de antes (AlbumGrid). Capa de
// conquistas e Collections viraram seções próprias antes da listagem — o
// livro aqui só tem páginas de ano e "Ainda por vir" (figurinhas soltas).
export function AlbumBook(props: {
  tickets: AlbumTicket[];
  collections: CollectionView[];
  onSelect: (tokenId: number) => void;
}) {
  return (
    <Suspense fallback={null}>
      <AlbumBookInner {...props} />
    </Suspense>
  );
}

function AlbumBookInner({
  tickets,
  collections,
  onSelect,
}: {
  tickets: AlbumTicket[];
  collections: CollectionView[];
  onSelect: (tokenId: number) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pages = useMemo<Page[]>(() => {
    const now = Date.now();
    // Collections e Conquistas vivem fora do álbum agora (seções próprias
    // antes da listagem) — mas o corte de duplicata segue: um ingresso já
    // mostrado numa Collection não aparece de novo na página do ano.
    const slottedEventIds = new Set(collections.flatMap((c) => c.slots.map((s) => s.eventId)));
    const upcoming = tickets.filter((t) => new Date(t.eventDate).getTime() >= now);
    const past = tickets.filter(
      (t) => new Date(t.eventDate).getTime() < now && !slottedEventIds.has(t.eventId)
    );

    const byYear = new Map<number, AlbumTicket[]>();
    for (const t of past) {
      const year = new Date(t.eventDate).getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push(t);
    }
    const years = [...byYear.keys()].sort((a, b) => b - a);

    const result: Page[] = [];
    for (const y of years) result.push({ kind: "year", year: y, tickets: byYear.get(y)! });
    if (upcoming.length > 0) result.push({ kind: "loose", tickets: upcoming });
    return result;
  }, [tickets, collections]);

  const [pageIndex, setPageIndex] = useState(0);
  const [renderedIndex, setRenderedIndex] = useState(0);
  // Guarda a página que SAI: ela vira por cima enquanto a nova já está
  // montada embaixo — é assim num livro, a página de baixo já estava lá.
  const [flip, setFlip] = useState<{ direction: 1 | -1; leaving: Page } | null>(null);
  const matchedFromUrlRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deep link ?page=<slug> — tenta casar de novo a cada vez que `pages` muda,
  // até achar (coleções chegam por fetch assíncrono depois do primeiro
  // render, então a página pedida pode não existir ainda na 1ª tentativa).
  useEffect(() => {
    if (matchedFromUrlRef.current) return;
    const slug = searchParams.get("page");
    if (!slug) { matchedFromUrlRef.current = true; return; }
    const idx = pages.findIndex((p) => pageSlug(p) === slug);
    if (idx >= 0) {
      setPageIndex(idx);
      setRenderedIndex(idx);
      matchedFromUrlRef.current = true;
    }
  }, [pages, searchParams]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const goTo = useCallback(
    (newIndex: number) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, newIndex));
      if (clamped === pageIndex) return;
      const direction: 1 | -1 = clamped > pageIndex ? 1 : -1;

      // Virar duas páginas rápido cancela a anterior em vez de enfileirar
      // (PLANO_EVOLUCAO_V2.md §9.4.3) — limpa timers pendentes antes de agendar novos.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setPageIndex(clamped);
      router.replace(`${pathname}?page=${pageSlug(pages[clamped])}`, { scroll: false });

      const reducedMotion =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        setRenderedIndex(clamped);
        setFlip(null);
        return;
      }

      // Etapa única: a página nova entra embaixo na hora e a metade velha
      // gira por cima. Um único ponto de sincronia com o React (desmontar as
      // tiras no fim) — o movimento em si é 100% CSS.
      setFlip({ direction, leaving: pages[renderedIndex] });
      setRenderedIndex(clamped);
      timeoutRef.current = setTimeout(() => setFlip(null), TURN_MS);
    },
    [pages, pageIndex, renderedIndex, router, pathname]
  );

  const touchStartX = useRef<number | null>(null);

  if (pages.length === 0) {
    return <p className="text-sm text-text-muted">Todos os seus ingressos já estão nas coleções acima.</p>;
  }
  const current = pages[Math.min(renderedIndex, pages.length - 1)];
  const meta = pageMeta(current);

  const renderPage = (p: Page) => {
    const m = pageMeta(p);
    return (
      <AlbumPage title={m.title} countLabel={m.countLabel}>
        <TicketGrid tickets={p.tickets} onSelect={onSelect} />
      </AlbumPage>
    );
  };

  // A meia-folha que vira (§9.4.3) — avançar levanta a metade DIREITA,
  // voltar levanta a ESQUERDA; as duas giram em torno do vinco
  // (transformOrigin no centro), que é o que faz parecer livro em vez de
  // card girando. Cada tira é uma fatia vertical dessa metade, recortada por
  // clip-path, com atraso proporcional à distância da ponta: a ponta sai
  // primeiro e o resto acompanha, e é esse defasamento que curva o papel.
  // As tiras são decorativas (aria-hidden) e só existem durante a virada.
  const leaf = flip && (
    <div className="absolute inset-0" aria-hidden style={{ transformStyle: "preserve-3d" }}>
      {Array.from({ length: STRIPS }, (_, i) => {
        const fwd = flip.direction === 1;
        // Bandas de 50%→100% (avançar) ou 0%→50% (voltar).
        const from = fwd ? 50 + (i * 50) / STRIPS : (i * 50) / STRIPS;
        const to = from + 50 / STRIPS;
        // A ponta lidera: borda direita quando avança, esquerda quando volta.
        const leadOrder = fwd ? STRIPS - 1 - i : i;
        return (
          <div
            key={i}
            className="pointer-events-none absolute inset-0"
            style={{
              clipPath: `inset(0 ${100 - to}% 0 ${from}%)`,
              transformOrigin: "50% 50%",
              backfaceVisibility: "hidden",
              animation: `album-leaf-${fwd ? "fwd" : "back"} ${SWING_MS}ms cubic-bezier(.33,.05,.32,1) ${leadOrder * STAGGER_MS}ms both`,
            }}
          >
            {renderPage(flip.leaving)}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div
        tabIndex={0}
        role="group"
        aria-roledescription="álbum"
        aria-label={`Página ${pageIndex + 1} de ${pages.length}: ${meta.title}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") goTo(pageIndex + 1);
          if (e.key === "ArrowLeft") goTo(pageIndex - 1);
        }}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) < 50) return;
          goTo(delta < 0 ? pageIndex + 1 : pageIndex - 1);
        }}
        className="relative outline-none"
        style={{ perspective: 1600 }}
      >
        {/* A página nova fica embaixo desde o clique — é ela que dá altura ao
            container e recebe os cliques. A meia-folha velha gira por cima e
            some, revelando o que já estava lá. */}
        <div className="relative" style={{ transformStyle: "preserve-3d" }}>
          {renderPage(current)}
          {leaf}
        </div>
      </div>

      {pages.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={pageIndex === 0}
            onClick={() => goTo(pageIndex - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-text disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:border-ouro-500"
          >
            ‹
          </button>
          <span className="text-xs tabular-nums text-text-muted">{pageIndex + 1} / {pages.length}</span>
          <button
            type="button"
            aria-label="Próxima página"
            disabled={pageIndex === pages.length - 1}
            onClick={() => goTo(pageIndex + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-text disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:border-ouro-500"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
