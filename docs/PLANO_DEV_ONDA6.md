# Onda 6 — Plano de desenvolvimento

> **Aberto em:** 2026-08-07 · Folha de obra da Onda 6.
> O **porquê** de cada decisão está em `PLANO_EVOLUCAO_V2.md` §10 (D35–D43). Aqui é o **como**:
> ordem, migrations, endpoints, componentes e testes. Se os dois divergirem, o §10 manda.

---

## 0. Ordem de execução

As fases não são paralelizáveis à vontade — a **Fase 0 bloqueia a Fase 4**, e a Fase 1 tem raio de
alcance grande demais para conviver com outra mudança no mesmo PR.

```
Fase 0 — Razão de lotação (D42)  ─────┐   pré-requisito duro
Fase 1 — endDate (D35)                │   sozinha num PR: muda 4 predicados
Fase 2 — Teto de revenda (D36, D37)   │   isolada
Fase 3 — Meia-entrada (D38, D39)      │   isolada
Fase 4 — Reserva + código (D40,41,43) ←┘   depende da Fase 0
```

Fases 1, 2 e 3 são independentes entre si e podem ir em qualquer ordem. Sugestão: **0 → 1 → 2 → 3 → 4**,
porque a Fase 4 é a maior e é melhor entrar nela com o resto estável.

| Fase | Tamanho | Migration? | Toca contrato? |
|---|---|---|---|
| 0 — Razão de lotação | M | Não | Não |
| 1 — `endDate` | M | **Sim** | Não |
| 2 — Teto de revenda | M | Não | Não |
| 3 — Meia-entrada | M | **Sim** | Não |
| 4 — Reserva + código | G | **Sim** | Não |

Nenhuma fase toca `smart_contracts/`. O teto de revenda é validação off-chain (`/api/listings`), o
contrato nunca soube dele.

---

## 1. Migrations

Quatro, uma por fase que precisa. Todas aditivas — nada de `DROP`.

### 1.1 Fase 1 — `Event.endDate`

```prisma
model Event {
  eventDate DateTime  @map("event_date")
  endDate   DateTime  @map("end_date")   // NOVO — obrigatório
}
```

Backfill obrigatório no mesmo migration, senão a coluna `NOT NULL` falha em base populada:

```sql
ALTER TABLE events ADD COLUMN end_date TIMESTAMP(3);
UPDATE events SET end_date = event_date WHERE end_date IS NULL;
ALTER TABLE events ALTER COLUMN end_date SET NOT NULL;
```

`end_date = event_date` preserva exatamente o comportamento de hoje — nenhum ingresso muda de aba
na migração. É o ponto: a migration é inerte, a mudança de comportamento vem do organizador
preenchendo o campo daí em diante.

### 1.2 Fase 3 — `Event.socialHalfBps`

```prisma
socialHalfBps Int? @map("social_half_bps") // null = usa a cota legal da UF (lib/socialHalfQuota.ts)
```

Nulável de propósito: `null` continua significando "usa a hierarquia UF → país → default", que é o
comportamento atual de todo evento existente. Só evento criado depois do slider grava número.

### 1.3 Fase 4 — `AccessCode` e `AccessEntry`

```prisma
model AccessCode {
  id        String    @id @default(cuid())
  eventId   String    @map("event_id")
  code      String    @unique                      // Crockford Base32, 10 chars — D43
  label     String?                                // "Afilhada do Zé" — quem recebeu
  createdBy String    @map("created_by")           // User.id do organizador
  createdAt DateTime  @default(now()) @map("created_at")
  usedAt    DateTime? @map("used_at")
  revokedAt DateTime? @map("revoked_at")

  event Event        @relation(fields: [eventId], references: [id])
  entry AccessEntry?

  @@index([eventId])
  @@map("access_codes")
}

model AccessEntry {
  id           String   @id @default(cuid())
  accessCodeId String   @unique @map("access_code_id")
  eventId      String   @map("event_id")
  staffUserId  String   @map("staff_user_id")
  scannedAt    DateTime @default(now()) @map("scanned_at")

  accessCode AccessCode @relation(fields: [accessCodeId], references: [id])
  event      Event      @relation(fields: [eventId], references: [id])
  staff      User       @relation(fields: [staffUserId], references: [id])

  @@index([eventId])
  @@map("access_entries")
}
```

**`AccessEntry` é tabela separada, não `Checkin`** (D43): `Checkin.tokenId` é `Int @unique` com FK
obrigatória para `Ticket` (`schema.prisma:401`), e entrada por código não tem ingresso. Fundir os
dois quebraria `computeAchievements`, que percorre `checkin.ticket.event.city`
(`lib/achievements.ts:30`) — e faria o produto contar como "presença de colecionador" alguém que
não tem colecionável.

`code` é `@unique` global, não `@@unique([eventId, code])` — o `POST /api/checkin` não recebe
`eventId` e deriva o evento do que foi escaneado. Unicidade global evita seletor de evento na tela
do operador.

---

## 2. Fase 0 — Razão de lotação (D42)

> Pré-requisito da Fase 4. Também conserta um bug que já existe: a exibição ignora `inFlight`.

### 2.1 `lib/availability.ts` — reescrita

Hoje é aritmética pura de 17 linhas com assinatura `publicAvailability(event, soldCount)`. Passa a
ser o razão de lotação:

```ts
export interface CapacityUsage {
  sold:          number; // Ticket emitido
  inFlight:      number; // Purchase PENDING | PAID | MINTING (listingId: null)
  codesPending:  number; // AccessCode com usedAt=null e revokedAt=null  ← Fase 4
  unusedReserve: number; // reservedTickets − reservedTicketsAssigned
}

export async function loadCapacityUsage(eventId: string, event: {...}): Promise<CapacityUsage>;

export function publicAvailability(
  event: { maxTickets: number | null },
  usage: CapacityUsage
): number | null;   // null = sem teto

export function hardCapAvailability(  // ignora unusedReserve — usado pela cota reservada
  event: { maxTickets: number | null },
  usage: CapacityUsage
): number | null;
```

**A troca de assinatura é o ponto, não efeito colateral.** `publicAvailability(event, soldCount)`
aceitar um número solto é exatamente o que permite hoje passar `sold` sem `inFlight`. Trocar por
`CapacityUsage` faz o `tsc` listar todos os chamadores. **Não fazer com parâmetro opcional** — isso
derrotaria o objetivo e deixaria o bug vivo onde ninguém olhasse.

Na Fase 0, `codesPending` é sempre `0` (a tabela ainda não existe). Entra o campo já, para a Fase 4
não precisar mexer na assinatura de novo.

### 2.2 Chamadores a migrar

| Arquivo | Hoje | Depois |
|---|---|---|
| `app/page.tsx:99,260` | `publicAvailability(e, e._count.tickets)` | `loadCapacityUsage` em lote para os eventos da página |
| `app/api/events/[id]/route.ts` | idem | `loadCapacityUsage(id)` |
| `app/api/events/nearby/route.ts` | idem | idem, em lote |
| `app/api/organizer/events/route.ts` | idem | idem |
| `app/api/events/[id]/checkout/route.ts:100-118` | conta `sold + inFlight` inline | `publicAvailability` / `hardCapAvailability` |

**Cuidado com N+1**: a home lista até 24 eventos. `loadCapacityUsage` por evento = 24×3 queries.
Precisa de uma variante em lote (`loadCapacityUsageMany(eventIds)`) usando `groupBy` — uma query
por parcela, não por evento.

### 2.3 O que muda para o usuário

A disponibilidade exibida **cai** nos eventos com compras pendentes. Não é regressão: é a home
passando a dizer a verdade. Vale conferir no seed que nenhum card fica com número negativo (clamp
em zero já existe no `Math.max(0, …)` do `app/page.tsx:288`).

### 2.4 Testes

- `publicAvailability` com `maxTickets: null` → `null` (não `0`).
- Evento 500, `sold: 490`, `inFlight: 10` → exibição `0`, e o checkout também `0`. **Este é o teste
  que prova o bug consertado** — hoje a exibição daria 10.
- Reserva não atribuída sai da conta pública mas não do `hardCap`.

---

## 3. Fase 1 — `endDate` (D35)

### 3.1 Endpoints

| Método | Rota | Mudança |
|---|---|---|
| `POST` | `/api/organizer/events` | Aceita e **exige** `endDate`. Valida `endDate > eventDate`; `eventDate` no futuro (regra atual, `route.ts:114`) |
| `PATCH` | `/api/organizer/events/[id]` | Mesma validação; se só um dos dois vier, valida contra o valor persistido do outro |
| `GET` | `/api/market` | Corte de aba passa de `eventDate < now()` para **`endDate < now()`** (`route.ts:20`) |
| `GET` | `/api/events/[id]` | Devolve `endDate` |
| `GET` | `/api/events` , `/api/events/nearby` | Devolvem `endDate` |

### 3.2 "Já aconteceu" — os quatro predicados

Esta é a parte de risco. O corte passado/futuro decide se um ingresso é ingresso ou colecionável, e
portanto em que aba da Revenda ele pode ser anunciado e sob qual regra.

| Arquivo | Linha | Predicado hoje | Vira |
|---|---|---|---|
| `api/market/route.ts` | 20 | `event.eventDate < now` | `event.endDate < now` |
| `app/page.tsx` | 86 e where da listagem | `eventDate: { gte: now }` | **fica `eventDate`** — a home ordena por início, não por fim |
| `my-tickets/page.tsx` | `isListable`, `isUpcoming` | `event.eventDate` | `event.endDate` |
| `components/ui/AlbumBook.tsx` | `pages` useMemo | `t.eventDate >= now` | `t.endDate >= now` |
| `revenda/page.tsx` | `sellableTickets` | `event.eventDate` | `event.endDate` |

> **A home é exceção deliberada.** "Próximos eventos" lista o que ainda vai *começar*; um festival
> em andamento não é "próximo". Só o corte **ingresso ↔ colecionável** muda para `endDate`.

Isso exige `endDate` no payload de `/api/me/tickets` (hoje o `event` selecionado ali não o traz).

### 3.3 Componentes

- **`NewEventModal.tsx`** — Step 1 ganha "Data e hora de término" (`datetime-local`) ao lado do
  início. `step1Valid` passa a exigir os dois e a ordem entre eles.
- **`organizer/page.tsx`** — coluna Data mostra intervalo quando `endDate` difere do dia de início
  (`12–14 set`), senão só a data. Sem coluna nova.
- **`events/[id]/page.tsx`** — cabeçalho mostra início → fim.

### 3.4 Testes

- Evento de 3 dias, "hoje" no dia 2: **continua na aba Ingressos** e o ingresso **não** é
  anunciável como colecionável. É o caso que motivou a fatia.
- `endDate < eventDate` → 400.
- Migration: evento antigo com `endDate = eventDate` mantém exatamente a aba de antes.

---

## 4. Fase 2 — Teto de revenda (D36, D37)

### 4.1 `lib/resaleCap.ts` (novo)

```ts
// D36 — só ESPORTE tem teto legal (Lei 14.597/2023 art. 166). Nas demais
// categorias 100% é default de produto, e o organizador pode afrouxar.
export const LEGAL_CAP_CATEGORIES = ["ESPORTE"] as const;
export const LEGAL_CAP_BPS = 10_000;

export function isResaleCapMandatory(category: string): boolean;

/** Normaliza o teto pedido pelo organizador. Em categoria travada, ignora a
 *  entrada e devolve 10000 — validação de servidor, não de UI. */
export function resolveMaxResaleBps(category: string, requested: number | null): number | null;

/** D37 — a plataforma abre mão da própria taxa quando ninguém lucra na
 *  revenda, para o vendedor conseguir recuperar o que pagou. */
export function resaleFeeBps(event: {platformFeeBps: number}, priceUsdc: number, facePrice: number): number;
```

### 4.2 A inversão da validação

`api/organizer/events/route.ts:154-160` hoje exige `bps >= 10000` — impede teto **abaixo** de 100%
e não impõe limite superior. Inverter:

```ts
// antes: if (!Number.isInteger(bps) || bps < 10000) → 400
// depois:
if (!Number.isInteger(bps) || bps < 1) → 400
if (isResaleCapMandatory(category) && bps !== LEGAL_CAP_BPS) → 400   // ou força silenciosamente
if (bps > LEGAL_CAP_BPS && isResaleCapMandatory(category)) → 400
```

O piso de 100% some: um organizador pode querer teto de 80% (revenda sempre com desconto), e nada
na lei impede.

### 4.3 Endpoints

| Método | Rota | Mudança |
|---|---|---|
| `POST` | `/api/organizer/events` | `resolveMaxResaleBps(category, body.maxResaleBps)`; 400 se esporte pedir ≠ 10000 |
| `PATCH` | `/api/organizer/events/[id]` | Idem. **Atenção**: mudar categoria para `ESPORTE` precisa re-normalizar o teto |
| `POST` | `/api/listings` | Cap check já existe (`route.ts:63-68`). Passa a usar `resaleFeeBps` no split devolvido |
| `POST` | `/api/negotiations` | Idem (`route.ts:38`) |
| `POST` | `/api/negotiations/[id]/counter` | Idem (`route.ts:33`) |
| `GET` | `/api/market` | `sellerReceivesBrl` passa a refletir a isenção |

### 4.4 `lib/split.ts`

`computeResaleSplit` **não muda** — continua recebendo bps como entrada. O que muda é quem chama
passar `resaleFeeBps(...)` em vez de `event.platformFeeBps` cru. Manter a função pura é o que
garante que ela siga espelhando o contrato.

### 4.5 Componentes

- **`NewEventModal.tsx`** — `RESALE_CAP_OPTIONS` (linha 56) reordenado com 100% como default. Em
  `ESPORTE`, o select vira campo travado em "Até 100%" com nota citando a lei. As opções de 150% e
  200% ganham aviso de exposição ao CDC.
- **`revenda/page.tsx`** — o modal de Detalhes já mostra a quebra do split (§3.8); passa a mostrar
  "Taxa da plataforma: isenta (revenda sem lucro)" quando aplicável.

### 4.6 Testes

- Evento `ESPORTE` com `maxResaleBps: 20000` no body → 400 ou coerção para 10000.
- Anúncio a exatamente 100% da face → `platformFee === 0`.
- Anúncio a 99% → também isento (a regra é "não lucrou", não "está exatamente no teto").
- `prisma/seed.ts` — os eventos de esporte com 150%/200% (linhas 180, 246, 262) viram dados
  inválidos; ajustar ou trocar a categoria deles.

---

## 5. Fase 3 — Meia-entrada (D38, D39)

### 5.1 `lib/socialHalfQuota.ts` — o que entra

```ts
// D38 — Lei 12.933/2013 assegura meia em 40% dos ingressos de espetáculo
// artístico-cultural ou esportivo. Nessas categorias é piso, não opção.
const MANDATORY_CATEGORIES = ["SHOW", "FESTIVAL", "TEATRO", "ESPORTE"] as const;
export function isSocialHalfMandatory(category: string): boolean;

// socialHalfCap passa a ler o bps escolhido pelo organizador antes de cair na cota legal.
export function socialHalfCap(event: {
  maxTickets: number | null;
  country: string; state: string | null;
  socialHalfBps: number | null;   // NOVO
}): number | null;
```

`CONFERENCIA` e `OUTRO` ficam fora da lista até **A12** ser respondida (§10.3) — hoje entram como
opcionais com default ligado.

### 5.2 Endpoints

| Método | Rota | Mudança |
|---|---|---|
| `POST` | `/api/organizer/events` | Se categoria coberta: força `hasSocialHalf: true` e `socialHalfBps >= 4000`, **ignorando o body**. UI desabilitada não é validação |
| `PATCH` | `/api/organizer/events/[id]` | Idem — inclusive ao **mudar a categoria** de `OUTRO` para `SHOW` |
| `POST` | `/api/events/[id]/checkout` | `socialHalfCap(event)` passa a receber `socialHalfBps` (`route.ts:124`). Nenhuma outra mudança — o padrão `sold + inFlight` continua |

### 5.3 Componentes

**`NewEventModal.tsx`**, Step 2, substitui o checkbox atual (linhas 244-261):

```
maxTickets preenchido           →  <input type="range">  0–100%, passo 5
                                   min = 40 se categoria coberta
                                   legenda: "40% = 200 de 500 ingressos"

maxTickets vazio                →  <input type="checkbox">
                                   marcado + disabled se categoria coberta
                                   nota: "cota aplicada sobre o total vendido"
```

Em ambos os casos, categoria coberta mostra o motivo do travamento citando a lei — o organizador
precisa entender que não é capricho do produto.

O componente já importa `getSocialHalfQuotaBps` (linha 7) para exibir a cota; passa a importar
`isSocialHalfMandatory` junto.

> **Componente novo sugerido:** `components/ui/RangeField.tsx`, seguindo o padrão de `Field`/
> `SelectField`. Não existe slider no design system hoje, e embutir um `<input type="range">` cru
> no modal foge da convenção dos outros campos.

### 5.4 Testes

- Categoria `TEATRO` com `hasSocialHalf: false` no body → persistido `true`.
- `socialHalfBps: 2000` em categoria coberta → 400 ou coerção para 4000.
- `PATCH` mudando `OUTRO` → `SHOW` liga a meia sozinho.
- Evento sem `maxTickets` e com meia: `socialHalfCap` devolve `null` e o checkout **não** trava.

---

## 6. Fase 4 — Reserva e código de entrada (D40, D41, D43)

> Depende da Fase 0. Sem a razão de lotação, o código de entrada não tem como consumir vaga com
> segurança.

### 6.1 Reserva sem `maxTickets` (D40)

A mudança é pequena e cirúrgica: **separar "segurar vagas" de "nomear beneficiário"**.

| Método | Rota | Mudança |
|---|---|---|
| `POST` | `/api/events/[id]/checkout` | Com `useReservedAllocation: true`, o guard `reservedTicketsAssigned >= reservedTickets` (`route.ts:88`) passa a valer **só quando `maxTickets !== null`**. Sem teto não há cota a esgotar |
| `POST` | `/api/organizer/events` | `reservedTickets` continua exigindo `maxTickets` (é cota). Sem teto, aceita `0` sem erro |

**Componentes:**
- **`NewEventModal.tsx:288-300`** — o campo "Qtd. de ingressos reservados" deixa de ficar
  `disabled` sem `maxTickets`. Vira: com teto, input numérico; sem teto, texto explicando que não é
  preciso segurar vaga para presentear, com link para a ação na tabela.
- **`organizer/page.tsx:215-228`** — a coluna "Reservados" hoje só mostra "Atribuir" quando
  `reservedTickets > 0`. Passa a mostrar sempre que o evento estiver `ON_SALE`: com teto, o
  contador `n / N`; sem teto, só o botão.

### 6.2 Código de entrada — endpoints novos

#### `POST /api/organizer/events/[id]/access-codes`

Emite N códigos. **Transacional com lock** — é o único caminho que grava direito de entrada sem
passar por contrato, então não pode ser o lado frouxo.

```
Auth: organizador dono do evento (403 caso contrário)
Body: { count: number, label?: string }

$transaction(async tx => {
  await tx.$queryRaw`SELECT id FROM events WHERE id = ${id} FOR UPDATE`
  const usage = await loadCapacityUsage(id, event, tx)
  const avail = publicAvailability(event, usage)
  if (avail !== null && count > avail) → 409 { error, available: avail }
  return tx.accessCode.createMany({ data: gerarNCodigos() })
})

201 → { codes: [{ id, code, label, createdAt }] }
```

- `count` entre 1 e 100 (lote acima disso é erro de digitação, não caso de uso).
- `avail === null` (evento sem teto) → sem limite.
- Geração: `crypto.randomBytes` → Crockford Base32, 10 chars. **Nunca `Math.random`.**
- Colisão de `code` (`@unique`) → retry até 3 vezes antes de 500.

#### `GET /api/organizer/events/[id]/access-codes`

```
200 → { codes: [{ id, code, label, createdAt, usedAt, revokedAt, entry: { scannedAt } | null }] }
```

Devolve o `code` em plaintext — é a razão de guardar assim (D43): o organizador precisa saber qual
código mandou para quem.

#### `DELETE /api/organizer/events/[id]/access-codes/[codeId]`

```
409 se usedAt !== null   — código queimado é registro de entrada, não some
200 → preenche revokedAt; a vaga volta a codesPending na mesma transação
```

Sem esta rota, `revokedAt` seria um campo que ninguém consegue preencher — foi o buraco encontrado
na revisão do §10.5.

### 6.3 Check-in por código — endpoint alterado

**Decisão de implementação:** um endpoint só, `POST /api/checkin`, aceitando as duas formas.

```ts
Body: { qrPayload: string } | { accessCode: string }
```

Não uma aba separada como o D20 previa. O motivo é operacional: a tela de check-in tem **uma**
câmera e **um** campo; obrigar o operador a escolher o modo antes de escanear é fricção na porta,
onde tem fila. O servidor decide pela forma do que chegou.

```
1. tem accessCode (ou qrPayload começa com "tessera:code:") → fluxo de código
2. senão → validateQrPayload atual, intocado
```

**Fluxo do código** (`$transaction`):
```
normaliza (uppercase, remove hífens)
busca AccessCode por code
  não achou           → 422 "Código inválido"
  revokedAt !== null  → 409 "Código revogado"
  usedAt !== null     → 409 "Código já utilizado" + scannedAt do AccessEntry
grava AccessEntry + preenche usedAt na MESMA transação
200 → { ok: true, kind: "access_code", event, label }
```

**Rate limit é obrigatório** nesta rota (D43). A entropia de 10 chars protege menos do que parece
contra força bruta num endpoint aberto — é o único ataque que o desenho não elimina sozinho. Sugestão:
limite por `staffUserId`, já que a rota exige STAFF/ADMIN autenticado.

**QR do código:** payload `tessera:code:v1:<CODE>`. O prefixo mantém válido o filtro
`raw.startsWith("tessera:")` que o scanner já usa (`checkin/page.tsx:91`) — sem ele, a câmera
ignoraria o QR do código.

### 6.4 Componentes da Fase 4

#### `components/AccessCodesModal.tsx` (novo)

Segue o padrão de `AssignReservedModal` (mesma forma: `open`/`eventId`/`authFetch`/`onClose`).

```
Estado 1 — gerar:  input de quantidade + label opcional
                   mostra "N vagas disponíveis" vindo do GET
                   Button "Gerar"
Estado 2 — lista:  tabela dos códigos do evento
                   código em fonte mono, botão copiar, QR sob demanda
                   Badge: Pendente / Usado (com data) / Revogado
                   "Revogar" por linha, só quando usedAt === null
```

#### `app/organizer/page.tsx`

- Coluna nova **"Códigos"** com `pendentes / total` e botão "Gerar códigos" abrindo o modal.
- `OrganizerEvent` ganha `accessCodesPending` e `accessCodesTotal` — vêm do
  `GET /api/organizer/events`, que precisa agregá-los junto das métricas que já calcula.
- `withZeroMetrics` (linha 46) precisa dos campos novos zerados, senão a linha recém-criada quebra.

#### `app/checkin/page.tsx`

- O campo manual deixa de ser só "cole o payload": aceita payload **ou** código de 10 caracteres.
  Placeholder e label mudam; a detecção é por forma, no servidor.
- `CheckinResult` ganha `kind: "ticket" | "access_code"`. O bloco de resultado (linhas 183-196)
  ramifica: para código, mostra "Entrada liberada por código", o `label` e o evento — **sem**
  número de ingresso nem token, que não existem.
- O filtro do scanner (linha 91) já aceita `tessera:` e portanto o `tessera:code:v1:` novo.

#### `lib/availability.ts`

`loadCapacityUsage` passa a contar de verdade:
```ts
codesPending: await prisma.accessCode.count({
  where: { eventId, usedAt: null, revokedAt: null },
})
```
Na Fase 0 era `0` fixo. Esta é a linha que faz o código consumir vaga — e o motivo de a Fase 0 ser
pré-requisito.

### 6.5 Testes

- **Vaga**: evento 100 com 100 vendidos → `POST access-codes` com `count: 1` responde 409.
- **Vaga devolvida**: gerar 5, revogar 2 → disponibilidade sobe 2.
- **Concorrência**: dois `POST access-codes` simultâneos em evento com 1 vaga → um 201, um 409.
  É o teste que justifica o `FOR UPDATE`.
- **Uso único**: mesmo código duas vezes → segundo 409 com a data do primeiro.
- **Revogado**: check-in com código revogado → 409.
- **Não vira conquista**: usuário que entrou por código não aparece em `computeAchievements` — é a
  garantia de que `AccessEntry` separado fez o que devia.
- **Reserva sem teto**: evento `maxTickets: null` + `useReservedAllocation: true` → 200.

---

## 7. Resumo de endpoints

### Novos (4)

| Método | Rota | Fase |
|---|---|---|
| `POST` | `/api/organizer/events/[id]/access-codes` | 4 |
| `GET` | `/api/organizer/events/[id]/access-codes` | 4 |
| `DELETE` | `/api/organizer/events/[id]/access-codes/[codeId]` | 4 |
| — | *(nenhuma rota nova de check-in — reusa `POST /api/checkin`)* | 4 |

### Alterados (11)

| Método | Rota | Fases |
|---|---|---|
| `POST` | `/api/organizer/events` | 1, 2, 3, 4 |
| `PATCH` | `/api/organizer/events/[id]` | 1, 2, 3 |
| `GET` | `/api/organizer/events` | 0, 4 |
| `POST` | `/api/events/[id]/checkout` | 0, 3, 4 |
| `GET` | `/api/events/[id]` | 0, 1 |
| `GET` | `/api/events/nearby` | 0, 1 |
| `GET` | `/api/market` | 1, 2 |
| `POST` | `/api/listings` | 2 |
| `POST` | `/api/negotiations` | 2 |
| `POST` | `/api/negotiations/[id]/counter` | 2 |
| `POST` | `/api/checkin` | 4 |
| `GET` | `/api/me/tickets` | 1 (expor `endDate`) |

### Componentes

| Arquivo | Fase | O quê |
|---|---|---|
| `components/NewEventModal.tsx` | 1,2,3,4 | Campo de fim; select de teto travado em esporte; slider/checkbox de meia; reserva sem teto |
| `components/AccessCodesModal.tsx` | 4 | **Novo** — gerar, listar, copiar, revogar |
| `components/ui/RangeField.tsx` | 3 | **Novo** — slider no padrão do design system |
| `app/organizer/page.tsx` | 1,4 | Coluna de datas com intervalo; coluna Códigos; Atribuir sem teto |
| `app/checkin/page.tsx` | 4 | Aceita código; resultado ramificado por tipo |
| `app/my-tickets/page.tsx` | 1 | `isListable`/`isUpcoming` por `endDate` |
| `components/ui/AlbumBook.tsx` | 1 | Corte passado/futuro por `endDate` |
| `app/revenda/page.tsx` | 1,2 | Elegibilidade por `endDate`; isenção de taxa no split |
| `app/events/[id]/page.tsx` | 0,1 | Mostra início → fim |
| `app/page.tsx` | 0 | Disponibilidade via `CapacityUsage` |

### Libs

| Arquivo | Fase | O quê |
|---|---|---|
| `lib/availability.ts` | 0, 4 | **Reescrita** — `CapacityUsage`, `loadCapacityUsage`, versão em lote |
| `lib/resaleCap.ts` | 2 | **Novo** — categoria travada, isenção de taxa |
| `lib/socialHalfQuota.ts` | 3 | `isSocialHalfMandatory`, `socialHalfBps` no cap |
| `lib/accessCode.ts` | 4 | **Novo** — geração Base32, normalização, validação de forma |
| `lib/split.ts` | 2 | **Não muda** — só quem chama passa outro bps |

---

## 8. Antes de codar

Três coisas que travam parte do escopo e não se resolvem com código:

| # | O quê | Trava |
|---|---|---|
| **A11** | Parecer sobre taxa de serviço destacada na revenda | Só o *upside* da Fase 2; o teto em si não depende |
| **A12** | `CONFERENCIA`/`OUTRO` entram na Lei 12.933? | A lista `MANDATORY_CATEGORIES` da Fase 3 |
| **A13** | Custo de plataforma da cortesia | A precificação da reserva na Fase 4 (não o mecanismo) |

E uma decisão de **negócio**, não de engenharia, que o D37 assume sem ter sido aprovada:
**a plataforma abrir mão de `platformFeeBps` em revenda sem lucro** é renúncia de receita. O
desenho está pronto (`resaleFeeBps`), mas alguém precisa dizer sim antes de ir para produção.
