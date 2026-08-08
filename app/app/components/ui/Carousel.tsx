"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

const AUTO_SCROLL_MS = 6000;

export interface CarouselSlide {
  href: string;
  grad: string;
  coverImageUrl?: string | null;
  coverVideoUrl?: string | null;
  rank: number;
  icon: IconName;
  tag: string;
  title: string;
  meta: string[];
  ctaLabel: string;
  priceLabel: string;
  price: string;
}

export function Carousel({ slides }: { slides: CarouselSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Duas fontes de pausa independentes — junta-las num "paused" só levaria a
  // um closure obsoleto no listener de visibilitychange (ele reativaria o
  // hover antigo ao voltar de aba oculta).
  const [interacting, setInteracting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const paused = interacting || hidden;
  const activeRef = useRef(active);
  // function ref pra evitar recriar o efeito de auto-scroll a cada render
  // (scrollToIndex é redefinida sempre, mas o efeito só depende de paused).
  const scrollToIndexRef = useRef<(i: number) => void>(() => {});
  // incrementado por qualquer navegação manual, pra reiniciar o timer em vez
  // de matá-lo — senão o carrossel fica parado pro resto da sessão.
  const [restartTick, setRestartTick] = useState(0);

  const scrollToIndex = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = i >= slides.length ? 0 : Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    setActive(clamped);
  };

  // Refs existem pra serem lidos de fora do render (aqui, dentro do
  // setInterval abaixo) — sincronizá-los é trabalho de efeito, não de render.
  useEffect(() => {
    activeRef.current = active;
    scrollToIndexRef.current = scrollToIndex;
  });

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      scrollToIndexRef.current(activeRef.current + 1);
    }, AUTO_SCROLL_MS);
    return () => clearInterval(id);
  }, [slides.length, paused, restartTick]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (slides.length === 0) return null;

  // Navegação manual (setas, dots, teclado) — reinicia a contagem do
  // auto-scroll em vez de interrompê-lo de vez.
  const manualScrollToIndex = (i: number) => {
    scrollToIndex(i);
    setRestartTick((t) => t + 1);
  };

  return (
    <div
      className="relative"
      onPointerEnter={() => setInteracting(true)}
      onPointerLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={() => setInteracting(false)}
    >
      <div className="relative overflow-hidden rounded-xl">
        <div
          ref={trackRef}
          onScroll={(e) => {
            const track = e.currentTarget;
            const idx = Math.round(track.scrollLeft / track.clientWidth);
            setActive(idx);
          }}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Eventos em destaque"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") manualScrollToIndex(active + 1);
            if (e.key === "ArrowLeft") manualScrollToIndex(active - 1);
          }}
        >
          {slides.map((s, i) => (
            <Link
              key={s.href + i}
              href={s.href}
              className="relative flex h-[320px] w-full shrink-0 snap-start items-end overflow-hidden p-8 text-text"
              style={{ background: s.coverVideoUrl || s.coverImageUrl ? undefined : s.grad }}
            >
              {s.coverVideoUrl ? (
                <video
                  src={s.coverVideoUrl}
                  poster={s.coverImageUrl ?? undefined}
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  aria-hidden="true"
                />
              ) : s.coverImageUrl ? (
                <img
                  src={s.coverImageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  aria-hidden="true"
                />
              ) : (
                <Icon name={s.icon} className="absolute right-6 top-6 h-28 w-28 text-luz-500 opacity-15" />
              )}
              {(s.coverVideoUrl || s.coverImageUrl) && (
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(12,19,36,.92), rgba(12,19,36,.35) 55%, transparent 85%)" }}
                />
              )}
              <span className="absolute left-6 top-6 rounded-md bg-noite-900/60 px-2.5 py-1 text-xs font-semibold text-luz-500">
                #{s.rank}
              </span>
              <div className="relative z-10 flex flex-col gap-2">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-sm bg-noite-900/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-luz-500">
                  <Icon name="quadrifolio" />
                  {s.tag}
                </span>
                <h2 className="font-display text-3xl text-luz-500">{s.title}</h2>
                <div className="flex flex-col gap-0.5 text-sm text-luz-500/85">
                  {s.meta.map((m, j) => <span key={j}>{m}</span>)}
                </div>
                <div className="mt-2 flex items-center gap-4">
                  <span className="inline-flex h-11 items-center justify-center rounded-md bg-laranja-500 px-6 text-[15px] font-semibold text-noite-800">
                    {s.ctaLabel}
                  </span>
                  <div className="leading-tight text-luz-500">
                    <small className="block text-[11px] opacity-80">{s.priceLabel}</small>
                    <span className="text-lg font-bold tabular-nums">{s.price}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Destaque anterior"
            onClick={() => manualScrollToIndex(active - 1)}
            className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-noite-900/60 text-luz-500 hover:bg-noite-900/80 sm:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximo destaque"
            onClick={() => manualScrollToIndex(active + 1)}
            className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-noite-900/60 text-luz-500 hover:bg-noite-900/80 sm:flex"
          >
            ›
          </button>
          <div className="mt-3 flex justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para destaque ${i + 1}`}
                onClick={() => manualScrollToIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? "w-6 bg-ouro-400" : "w-1.5 bg-border-strong"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
