# Setup — Fase 0

## Pré-requisitos

- Node.js 20+
- Docker (para PostgreSQL local) ou PostgreSQL instalado
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`foundryup`)
- Anvil (incluído no Foundry)

## 1. Banco de dados

```bash
# Opção A: Docker
docker run -d --name tessera-pg \
  -e POSTGRES_DB=tessera \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16

# Opção B: Prisma local (sem Docker)
npx prisma dev
```

## 2. Configurar variáveis de ambiente

```bash
cp .env .env.local
# Preencher NEXT_PUBLIC_PRIVY_APP_ID e PRIVY_APP_SECRET com as chaves do dashboard Privy
# As demais variáveis já estão configuradas para Anvil local
```

## 3. Migrar banco e gerar client

```bash
npm run db:migrate    # cria as tabelas
npm run db:generate   # gera o Prisma Client
```

## 4. Deploy dos contratos no Anvil

```bash
# Terminal 1 — subir Anvil
anvil

# Terminal 2 — deploy
cd ../smart_contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Copiar os endereços impressos no console para o .env.local:
# NEXT_PUBLIC_NFT_ADDRESS=0x...
# NEXT_PUBLIC_SALE_ADDRESS=0x...
# NEXT_PUBLIC_RESALE_ADDRESS=0x...
```

## 5. Seed

```bash
npm run db:seed
```

## 6. Rodar a aplicação

```bash
npm run dev
# http://localhost:3000
```

## 7. Login local (personas de desenvolvimento)

Com `APP_ENV=local` no `.env.local`, aparece um botão âmbar **dev** no header
que troca entre as personas do seed sem passar pelo Privy:

| Persona | Role | Para testar |
|---|---|---|
| `admin@tessera.local` | ADMIN | painel `/admin`, aprovações, `simulate-payment` |
| `org@tessera.local` | ORGANIZER | painel `/organizer`, criação de eventos |
| `buyer@tessera.local` | BUYER | Minha Coleção com 5 ingressos, KYC completo |
| `novato@tessera.local` | BUYER | estados vazios — sem ingressos, sem KYC |
| `staff@tessera.local` | STAFF | `/checkin` |

A troca é instantânea (cookie httpOnly, sem OTP) e **somente leitura**: assumir
uma persona nunca escreve no banco, então a `walletAddress` semeada — que é o
que amarra os ingressos ao dono — nunca é sobrescrita.

> **Isto não existe fora do seu ambiente local.** O bypass tem dois gates
> independentes em `lib/devAuth.ts`: `APP_ENV === "local"` e `privyId` com
> prefixo `local-`. Com o primeiro fechado, `/api/dev/persona` responde 404 e
> `getAuthUser` ignora o cookie mesmo se ele for forjado à mão. O segundo faz
> com que o bypass seja incapaz de autenticar um usuário real do Privy, cujo id
> é sempre `did:privy:...`. Os gates são cobertos por `tests/unit/devAuth.test.ts`
> e `next.config.ts` derruba o build em CI se `APP_ENV=local` vazar.

Para exercitar o fluxo de autenticação real antes de subir, use as contas de
teste do Privy (dashboard → *User management → Authentication → Advanced →
Enable test accounts*), que dão um email e um OTP fixo.

---

## Opção C — Docker Compose (tudo de uma vez)

Sobe Postgres + Anvil + deploy dos contratos + app Next.js num único comando, sem precisar instalar Node/Foundry localmente.

```bash
# Na raiz do repo (não em app/)
cp .env.example .env
# Preencher NEXT_PUBLIC_PRIVY_APP_ID e PRIVY_APP_SECRET no .env (senão o login via Privy não funciona)

docker compose up -d
# http://localhost:3000  (RPC do Anvil em http://localhost:8545)
```

Serviços:
- `db` — Postgres 16
- `anvil` — node EVM local
- `contracts-deploy` — roda `forge install` (1ª vez) + `forge build` + `Deploy.s.sol`, escreve `app/lib/contracts/addresses.local.json`, depois sai (exit 0 esperado)
- `app` — lê os endereços gerados, roda migrations + seed, sobe `next dev` com hot reload (código de `app/` é montado como volume)

```bash
docker compose logs -f app     # acompanhar logs do app
docker compose down            # parar tudo (mantém dados do Postgres)
docker compose down -v         # parar e resetar Postgres + node_modules do container
```

---

## Estrutura do projeto

```
app/
├── app/                  Next.js App Router
│   ├── api/
│   │   └── auth/sync/    POST — upsert de usuário após login Privy
│   ├── providers.tsx     PrivyProvider client-side
│   └── layout.tsx
├── lib/
│   ├── db.ts             Prisma Client singleton
│   ├── privy.ts          Privy Server Client singleton
│   ├── signer/           Interface Signer (env var → KMS)
│   ├── chain/            viem publicClient + chain config
│   └── contracts/        ABIs + addresses (gerado pelo deploy script)
└── prisma/
    ├── schema.prisma     Schema completo (9 modelos)
    └── seed.ts           Dados de dev local
```
