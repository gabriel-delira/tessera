# Tessera

Plataforma de ingressos como NFT (ERC-721). Organizadores cadastram eventos, compradores pagam em fiat (PIX/cartão) e recebem um ingresso NFT mintado para uma carteira embutida (Privy). Inclui mercado secundário de revenda com royalties on-chain, check-in por QR rotativo e off-ramp (USDC → BRL) para organizadores.

## Status atual

`active` — venda primária, revenda, indexador on-chain, check-in e webhooks de PSP implementados e integrados (Fase 0-1 completas). Fluxo de compra direta em USDC e off-ramp efetivo ainda são parciais (stubs / jobs assíncronos pendentes).

## Documentação

### Marca e design

| Documento | Para quê |
|---|---|
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | **Fonte única de verdade** de cor, tipografia, forma, espaçamento e componentes. Inclui tokens CSS prontos e contrastes WCAG medidos. |
| [`REFACTOR_PREVIEW_DESIGN_SYSTEM.md`](./REFACTOR_PREVIEW_DESIGN_SYSTEM.md) | Plano de execução para alinhar `platform/preview` ao design system. ✅ executado |
| [`APP_DESIGN_SYSTEM_MIGRATION.md`](./APP_DESIGN_SYSTEM_MIGRATION.md) | O que mudar em `app/` (Next.js) para o app web adotar o design system. |
| [`MOBILE_APP_PLAN.md`](./MOBILE_APP_PLAN.md) | Arquitetura do app móvel: stack, telas, navegação e notificações nativas. |
| [`Tessera_Brand_Study_2.pdf`](./Tessera_Brand_Study_2.pdf) | Brand Book v1.0 (46 páginas) — fonte primária do design system. |
| [`Estrategico_de_Marca_v2.md`](./Estrategico_de_Marca_v2.md) · [`Identidade_Visual_e_Branding.md`](./Identidade_Visual_e_Branding.md) | Estratégia e identidade visual. |

> ⚠️ O Brand Book tem três divergências internas (hex do Violeta, família tipográfica e proporção de cor). Estão documentadas e resolvidas na seção 10 do `DESIGN_SYSTEM.md` — consulte antes de "corrigir" qualquer valor de cor ou fonte.

### Produto e engenharia

| Documento | Para quê |
|---|---|
| [`PLANO_EVOLUCAO_V2.md`](./PLANO_EVOLUCAO_V2.md) | **Decisões e plano de execução da rodada de agosto/2026** — ondas 1 a 4, do ajuste de home ao modelo `TicketType` e ao álbum de colecionáveis. |
| [`fluxos.md`](./fluxos.md) | Fluxos de compra, revenda e check-in. |
| [`stack_infra.md`](./stack_infra.md) | Stack e infraestrutura. |
| [`tech_debt.md`](./tech_debt.md) | Débito técnico conhecido. |
| [`testes.md`](./testes.md) | Estratégia de testes. |

## Como executar localmente

O projeto tem duas partes: contratos (`smart_contracts/`, Foundry) e app (`app/`, Next.js).

### 1. Smart contracts (Foundry)

```bash
cd smart_contracts
forge build
forge test                      # roda a suíte
anvil                           # node local em http://127.0.0.1:8545
# em outro terminal, faz o deploy local (CHAIN_ENV=local):
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

O deploy local: faz deploy de `MockUSDC`, `TicketNFTLocked`, `TicketSale`, `TicketResale`, concede roles e transferors, define `baseURI`, registra o settler e grava os endereços em `app/lib/contracts/addresses.local.json`.

### 2. App (Next.js + Prisma)

```bash
cd app
npm install
npm run db:migrate              # prisma migrate dev (precisa do Postgres rodando)
npm run db:seed                 # opcional: popular dados
npm run dev                     # http://localhost:3000
```

Scripts disponíveis (`package.json`): `dev`, `build`, `start`, `lint`, `db:migrate`, `db:generate`, `db:seed`, `db:studio`.

> ⚠️ Esta versão do Next.js (16.x) tem breaking changes. Ver `app/AGENTS.md` antes de editar código do app.

## Variáveis de ambiente

Definidas em `app/.env` (sem `.env.example` no repo). Nomes:

- `DATABASE_URL` — Postgres
- `CHAIN_ENV` — `local` | `testnet` | `mainnet`
- `RPC_URL` — endpoint RPC da rede EVM
- `SIGNER_MODE` — `env` (chaves privadas locais) | `privy` (Privy Server Wallets)
- `OWNER_PRIVATE_KEY`, `TREASURY_PRIVATE_KEY` — modo `env`
- `OWNER_WALLET_ID`, `OWNER_WALLET_ADDRESS`, `TREASURY_WALLET_ID`, `TREASURY_WALLET_ADDRESS` — modo `privy`
- `PLATFORM_WALLET`, `TREASURY_WALLET` — usados pelo `Deploy.s.sol` (testnet/mainnet)
- `USDC_ADDRESS`, `NEXT_PUBLIC_NFT_ADDRESS`, `NEXT_PUBLIC_SALE_ADDRESS`, `NEXT_PUBLIC_RESALE_ADDRESS` — endereços dos contratos
- `BASE_URI` — base da URI de metadata
- `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` — Privy
- `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL` — app
- `FX_MID_RATE`, `FX_SPREAD_BPS` — câmbio BRL/USDC no checkout
- `PSP_PROVIDER` — `mock` | `pagarme` | `stripe`
- `QR_SECRET` — assinatura HMAC do QR de check-in
- `INDEXER_START_BLOCK` — bloco inicial do indexador (opcional)
