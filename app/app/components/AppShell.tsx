"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { DevPersonaSwitcher } from "./DevPersonaSwitcher";
import { Logo } from "./Logo";

type Role = "BUYER" | "ORGANIZER" | "ADMIN" | "STAFF";

const NAV_ITEMS: { href: string; label: string; roles?: Role[]; requiresAuth?: boolean }[] = [
  { href: "/", label: "Eventos" },
  { href: "/revenda", label: "Revenda" },
  { href: "/my-tickets", label: "Minha Coleção", requiresAuth: true },
  { href: "/organizer", label: "Organizador", roles: ["ORGANIZER"] },
  { href: "/admin", label: "Admin", roles: ["ADMIN"] },
  { href: "/checkin", label: "Check-in", roles: ["STAFF", "ADMIN"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, authenticated, login, logout, getAccessToken } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [pendingNegotiations, setPendingNegotiations] = useState(0);

  useEffect(() => {
    if (!ready || !authenticated) {
      setRole(null);
      setPendingNegotiations(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) {
        setRole(data.role);
        setPendingNegotiations(data.pendingNegotiations ?? 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  // D28 (PLANO_EVOLUCAO_V2.md §9.1) — itens de conta só aparecem logado.
  // signedIn já exige `ready`, então o item nasce escondido em vez de
  // piscar (aparecer é menos violento que sumir debaixo do cursor).
  // "Minha Coleção" é só pra quem compra ingresso — organizador, staff e
  // admin não são compradores (hoje), então some pra esses três papéis.
  // Exclusão pontual, não um allowlist de roles.
  const signedIn = ready && authenticated;
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      (!item.requiresAuth || signedIn) &&
      (!item.roles || (role && item.roles.includes(role))) &&
      !(item.href === "/my-tickets" && (role === "ORGANIZER" || role === "STAFF" || role === "ADMIN"))
  );
  const isHome = pathname === "/";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-6 border-b border-border bg-noite-800/85 px-6 py-3.5 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5 text-ouro-400">
          <Logo size={28} />
          <span className="font-display text-[19px] font-medium tracking-[0.25em] text-text">
            TESSERA
          </span>
        </Link>
        <nav className="flex flex-1 gap-0.5">
          {visibleItems.map((item) => {
            const active = item.href === "/" ? isHome : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3.5 py-2.5 text-sm font-medium ${
                  active ? "text-text font-semibold" : "text-text-muted hover:text-text"
                }`}
              >
                {item.label}
                {item.href === "/revenda" && pendingNegotiations > 0 && (
                  <span
                    aria-label={`${pendingNegotiations} negociações pendentes`}
                    className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-laranja-500 px-1 text-[10px] font-bold text-noite-800"
                  >
                    {pendingNegotiations}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-3.5 -bottom-[1px] h-0.5 rounded-full bg-laranja-500" />
                )}
              </Link>
            );
          })}
        </nav>
        <DevPersonaSwitcher />
        {ready && authenticated ? (
          <button
            onClick={logout}
            className="h-11 rounded-md border border-border-strong bg-transparent px-5 text-[15px] font-semibold text-text hover:bg-white/5"
          >
            Sair
          </button>
        ) : (
          <button
            onClick={login}
            className="h-11 rounded-md bg-laranja-500 px-5 text-[15px] font-semibold text-noite-800 hover:bg-laranja-400"
          >
            Entrar com email
          </button>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        {isHome && (
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-8 px-6 py-10">
            <div className="flex items-center gap-2.5 text-text-muted">
              <Logo size={24} />
              <span className="font-display text-sm tracking-[0.2em]">TESSERA</span>
            </div>
            <div className="flex gap-12 text-sm">
              <div className="flex flex-col gap-2">
                <strong className="font-sans text-text">Produto</strong>
                <Link href="/" className="text-text-muted hover:text-text">Eventos</Link>
                <Link href="/revenda" className="text-text-muted hover:text-text">Revenda</Link>
              </div>
              <div className="flex flex-col gap-2">
                <strong className="font-sans text-text">Conta</strong>
                {signedIn && role !== "ORGANIZER" && role !== "STAFF" && role !== "ADMIN" && (
                  <Link href="/my-tickets" className="text-text-muted hover:text-text">Minha Coleção</Link>
                )}
                {role !== "STAFF" && role !== "ADMIN" && (
                  <Link href="/organizer" className="text-text-muted hover:text-text">Organizador</Link>
                )}
              </div>
            </div>
          </div>
        )}
        <p className="px-6 py-4 text-center text-xs text-text-muted">Tessera — ingressos digitais</p>
      </footer>
    </div>
  );
}
