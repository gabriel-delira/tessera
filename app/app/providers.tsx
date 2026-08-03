"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { base, baseSepolia, anvil } from "viem/chains";
import { DevAuthProvider } from "./components/AuthProvider";

const chains = [base, baseSepolia, anvil];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: { theme: "dark", accentColor: "#FF6A00" },
        loginMethods: ["email", "google"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        defaultChain: base,
        supportedChains: chains,
      }}
    >
      <DevAuthProvider>{children}</DevAuthProvider>
    </PrivyProvider>
  );
}
