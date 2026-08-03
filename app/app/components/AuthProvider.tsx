"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

// Fonte única de verdade de autenticação no client.
//
// Em produção é um passthrough fino do usePrivy. Em desenvolvimento local, se
// /api/dev/persona responder (ela devolve 404 quando APP_ENV !== "local"),
// permite assumir uma das personas semeadas sem passar pelo Privy.
//
// Componentes devem usar useAuth() em vez de usePrivy() diretamente, senão a
// persona assumida não é enxergada e a UI fica dessincronizada do servidor.

export type PersonaRole = "BUYER" | "ORGANIZER" | "ADMIN" | "STAFF";

export type Persona = {
  privyId: string;
  email: string | null;
  role: PersonaRole;
  displayName: string | null;
  walletAddress: string | null;
  kycLevel: string;
  ticketCount: number;
};

type DevAuth = {
  /** true quando o backend confirmou que o bypass local está ligado. */
  devEnabled: boolean;
  personas: Persona[];
  persona: Persona | null;
  assumePersona: (privyId: string) => Promise<void>;
  releasePersona: () => Promise<void>;
};

const DevAuthContext = createContext<DevAuth>({
  devEnabled: false,
  personas: [],
  persona: null,
  assumePersona: async () => {},
  releasePersona: async () => {},
});

export function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const [devEnabled, setDevEnabled] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    // 404 = gate de ambiente fechado; é o caminho esperado em produção, e aí
    // o provider fica inerte e useAuth() vira um passthrough do Privy.
    fetch("/api/dev/persona", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setDevEnabled(true);
          setPersonas(data.personas ?? []);
          setCurrent(data.current ?? null);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });

    return () => controller.abort();
  }, []);

  const assumePersona = useCallback(async (privyId: string) => {
    const res = await fetch("/api/dev/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privyId }),
    });
    if (!res.ok) return;
    setCurrent(privyId);
    // Recarrega para que todo dado já buscado seja refeito sob a nova persona.
    window.location.reload();
  }, []);

  const releasePersona = useCallback(async () => {
    await fetch("/api/dev/persona", { method: "DELETE" });
    setCurrent(null);
    window.location.reload();
  }, []);

  const persona = personas.find((p) => p.privyId === current) ?? null;

  // Memoizado porque este objeto acaba nas dependências de efeitos dos
  // consumidores (via useAuth): recriá-lo a cada render dispara refetch em
  // loop nas telas que buscam dados em useEffect.
  const value = useMemo(
    () => ({
      devEnabled: devEnabled && loaded,
      personas,
      persona,
      assumePersona,
      releasePersona,
    }),
    [devEnabled, loaded, personas, persona, assumePersona, releasePersona],
  );

  return <DevAuthContext.Provider value={value}>{children}</DevAuthContext.Provider>;
}

/**
 * Sessão de persona não tem token — ela viaja no cookie httpOnly, que o fetch
 * envia sozinho por ser same-origin, e getAuthUser lê o cookie antes do header.
 *
 * Definida no módulo, e não inline em useAuth, para ter identidade estável:
 * os consumidores põem getAccessToken em deps de useCallback/useEffect
 * (ex.: market/page.tsx), e uma função nova a cada render vira loop de render.
 */
const noAccessToken = async (): Promise<string | null> => null;

/** Mesma razão: login não faz sentido com persona assumida, mas precisa ser estável. */
const noopLogin = () => {};

/**
 * Substitui usePrivy() nos componentes. A superfície é compatível de propósito
 * (ready/authenticated/login/logout/getAccessToken), então a migração é troca
 * de import — com o acréscimo de walletAddress, que antes vinha de
 * user?.wallet?.address e não existe quando a sessão é uma persona local.
 */
export function useAuth() {
  const privy = usePrivy();
  const dev = useContext(DevAuthContext);

  const privyWallet = privy.user?.wallet?.address?.toLowerCase();
  const personaWallet = dev.persona?.walletAddress?.toLowerCase();

  // O retorno inteiro é memoizado: componentes derivam callbacks e efeitos
  // destes campos, então identidade instável aqui vira refetch em loop lá.
  return useMemo(() => {
    if (dev.persona) {
      return {
        ready: true,
        authenticated: true,
        getAccessToken: noAccessToken,
        login: noopLogin,
        logout: dev.releasePersona,
        walletAddress: personaWallet,
        ...dev,
      };
    }

    return {
      ready: privy.ready,
      authenticated: privy.authenticated,
      getAccessToken: privy.getAccessToken,
      login: privy.login,
      logout: privy.logout,
      walletAddress: privyWallet,
      ...dev,
    };
  }, [
    dev,
    personaWallet,
    privyWallet,
    privy.ready,
    privy.authenticated,
    privy.getAccessToken,
    privy.login,
    privy.logout,
  ]);
}
