import type { NextConfig } from "next";

// Canário de pipeline: APP_ENV=local liga o bypass de autenticação de
// lib/devAuth.ts, que dá sessão às personas do seed sem passar pelo Privy.
//
// A contenção de verdade é o gate em runtime — APP_ENV não é embutida no
// bundle, é lida a cada request no servidor. O que este bloco pega é uma
// esteira de deploy mal configurada, onde a variável do build provavelmente
// também estará no runtime.
//
// Só derruba o build em CI: na máquina do dev o .env.local legitimamente tem
// APP_ENV=local, e `npm run build` precisa continuar rodando ali.
if (process.env.NODE_ENV === "production" && process.env.APP_ENV === "local") {
  const message =
    "APP_ENV=local em build de produção — isso habilita o bypass de " +
    "autenticação de lib/devAuth.ts, que dá sessão sem verificar token.";

  if (process.env.CI) {
    throw new Error(`${message} Remova APP_ENV do ambiente de build.`);
  }
  console.warn(`\n⚠  ${message} Build local, seguindo.\n`);
}

const nextConfig: NextConfig = {};

export default nextConfig;
