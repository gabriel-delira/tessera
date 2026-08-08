# Tessera — Plano de Evolução V2

> **Status:** aprovado, em execução · **Aberto em:** 2026-08-03
> Registra as decisões de produto tomadas na rodada de revisão de agosto/2026 e o plano de
> execução de cada uma. Complementa — não substitui — `LAYOUT_UPDATE.md` (spec de layout
> vigente) e `DESIGN_SYSTEM.md` (fonte única de cor/tipografia/forma).

---

## 0. Como ler este documento

- **§1** é o log de decisões: o que ficou fechado e *por quê*. Se a implementação divergir
  daqui, o documento é que está errado — atualize-o.
- **§2** é o que já foi entregue nesta rodada.
- **§3 a §6** são as ondas de execução, em ordem. Cada item traz **Decisão**, **Como faço**,
  **Arquivos**, **Tamanho** e **Riscos**.
- **§7** lista o que continua em aberto — nada em §3–§6 depende dessas respostas.
- **§8** é o apêndice de cor da barra de escassez, porque essa decisão tem detalhe suficiente
  para viver sozinha.

Tamanhos: **P** = horas · **M** = 1–3 dias · **G** = projeto próprio, semanas.

---

## 1. Decisões fechadas

| # | Tema | Decisão | Onda |
|---|---|---|---|
| D1 | Nome da aba "Mercado" | Renomear para **Revenda**, subtítulo *"Ingressos e colecionáveis entre pessoas"*. Rota passa a `/revenda` com redirect permanente de `/market`. | 2 |
| D2 | Botão do dono no Mercado | Continua **Detalhes** (já existe) e ganha o painel de analytics do anúncio. | 2 |
| D3 | "Você recebe" no modal de Detalhes | **É bug.** Mostra o preço bruto; deve mostrar o líquido via `computeResaleSplit`. Corrigir na Onda 1. | 1 |
| D4 | Crédito de comida / consumo | Vira **voucher de item** ("1 combo"), não saldo em reais. Fase 4. Saldo em reais é produto financeiro e não entra agora. | 4 |
| D5 | Auto-scroll do carrossel | Sim, com pausa em hover/foco/aba oculta e desligado sob `prefers-reduced-motion`. | 1 |
| D6 | Filtro "Perto de você" | Sim. Reaproveita `/api/events/nearby` + `lib/geolocate.ts`, que hoje só servem ao modal do mapa. | 1 |
| D7 | Ordenação da lista | 5 opções via `?sort=`: data (default), A→Z, Z→A, preço ↑, preço ↓. | 1 |
| D8 | Eventos passados na home | **É bug.** A home não filtra por data e lista eventos já ocorridos sob o título "Próximos eventos". Passa a filtrar `eventDate >= now()`. | 1 |
| D9 | Mapa "não mostra eventos" | **Não é falta de marcação** — os 12 eventos do seed têm lat/lng. O modal busca num raio fixo de 300 km da localização do usuário. Troca para **bbox do mapa** com refetch debounced em `moveend`/`zoomend`. Clustering só acima de ~200 pinos. | 1 |
| D10 | Pausados e esgotados na home | **Pausado**: escondido por padrão. **Esgotado**: continua visível, rebaixado para o fim da lista (é o card que alimenta a Revenda, CTA "Ver mercado"). Um único checkbox controla os dois. Rebaixamento só vale na ordenação default. | 1 |
| D11 | Cor da barra de escassez | Ouro → Laranja → **Violeta**. Sem vermelho. Ver §8. | 1 |
| D12 | Anunciar a partir de Minha Coleção | Sim. O roteamento futuro→Ingressos / passado→Colecionáveis **já é automático** (`/api/market` corta por `eventDate`), não precisa de código novo. | 1 |
| D13 | Arte da NFT | Template **SVG gerado no servidor** a partir dos dados do ingresso, com override de arte custom pelo organizador. Resolve também as "imagens que não renderizam" no álbum. | 4 |
| D14 | Modelo 3D | Mesma metadata, campo `animation_url`. Decisão de hoje é só gerar arte por template. | Futuro |
| D15 | Álbum de figurinhas com slot vazio | Aprovado como projeto próprio: `Collection` → `Slot`, definidos pelo organizador por edição/ano. | 4 |
| D16 | Conquistas na NFT | Metadata dinâmica off-chain + **hash de atestado** on-chain. Não escrever cada conquista na chain. | 4 |
| D17 | Minha Coleção para organizador | Escondida por role. | 2 |
| D18 | Presente / comprar para terceiro | Resolvido por **compra em nome de outra pessoa** (CPF/e-mail no checkout, mint direto na carteira do destinatário). **Transferência gratuita fica proibida** — abriria mercado paralelo e furaria o teto de revenda. | 3 |
| D19 | Reserva de ingressos pelo organizador | No nível de **oferta** (`Event.reservedTickets`), não de mint antecipado. O convidado passa pelo fluxo normal e ganha o colecionável. | 3 |
| D20 | Código de acesso sem NFT | **Adiado.** Só como exceção (imprensa/cortesia) e só quando houver organizador pedindo. Sem ele, a aba "Acesso via código" no check-in e o botão "Gerar códigos" também ficam fora do escopo. | — |
| D21 | Criação de evento | Modal **step-by-step** com breadcrumb de 3 passos, substituindo o `<details>` atual. | 2 |
| D22 | Step 2 (dados do ingresso) | **Híbrido acordeon + tabela**: perguntas simples geram a matriz de tipos de ingresso, exibida como tabela editável. Escape "fale com a gente" só para cauda-longa. | 3 |
| D23 | Modelo de dados de ingresso | Novo `TicketType` (área × dia × lote). `Event.ticketPriceUsdc` vira denormalização do menor preço, para não reescrever home/carrossel. **Toca o contrato.** | 3 |
| D24 | Meia-entrada | Cota **configurável por UF**, não número único: a lei federal 12.933/2013 não cobre professor (é lei estadual em alguns estados). Os 40% são teto da obrigação; o campo trava em 40% como piso operacional, mas o texto da UI não afirma que a lei exige mínimo. | 3 |
| D25 | Meia-entrada na revenda | **Ingresso de meia não entra na revenda.** É nominal e exige comprovante na portaria; revender como inteira quebra a lei. | 3 |
| D26 | Teto de revenda | **Mantido como está**: `maxResaleBps` incide sobre `Ticket.facePrice` (por ingresso). Não mudar para "preço do ingresso mais caro" — quem comprou lote 1 barato não deve poder revender no teto do lote 3. | — |
| D27 | Métricas na tabela do organizador | Sim: vendidos/capacidade, check-ins, receita primária, volume de revenda e royalties. | 2 |

---

## 2. Já entregue nesta rodada

### 2.1 Seed do mercado — 10 anúncios

`app/prisma/seed.ts`

8 anúncios na aba Ingressos (eventos futuros) e 2 em Colecionáveis (passados). 6 pertencem ao
`local-buyer` — exercitam a visão de dono (badge "Seu ingresso" + Detalhes) — e 4 a uma segunda
carteira Anvil, para exercitar Comprar e Fazer proposta. Preços respeitam o `maxResaleBps` de
cada evento.

> ⚠️ `onchainListingId` é sintético (900–909). `/api/market` exige esse campo não-nulo, senão o
> anúncio não aparece; mas o checkout **não fecha on-chain**, porque o listing não existe no
> `TicketResale` local. É fixture de UI, não de fluxo de compra.

### 2.2 Painel Admin — 4 ajustes

`app/app/admin/page.tsx` · `app/app/api/admin/events/[id]/feature/route.ts`

- `"Aprovar → on-chain"` → `"Aprovar"`.
- Removida a referência a `LAYOUT_UPDATE.md §4.1` do subtítulo de Destaques.
- **Bug do campo de posição corrigido**: era o spinner nativo do `input[type=number]`, que fica
  dentro da caixa de conteúdo e cobria o placeholder com `w-24 px-4`. Agora `w-28 pr-8` — os
  botões de incremento continuam, sem sobrepor o texto.
- **"Fixar" nunca mais bloqueado**: sem posição digitada o front envia `rank: "auto"` e o
  servidor grava `maior featuredRank em uso + 1`.

---

## 3. Onda 1 — superfície (dias)

Nada aqui toca schema nem contrato. É a onda que dá retorno visível mais rápido.

### 3.1 Ordenação + filtro de data da lista (D7, D8)

**Como faço.** `app/app/page.tsx` é Server Component e já lê `searchParams`. Adiciono `sort`:

| valor | `orderBy` |
|---|---|
| `date` (default) | `eventDate: "asc"` |
| `az` / `za` | `title: "asc" / "desc"` |
| `price_asc` / `price_desc` | `ticketPriceUsdc: "asc" / "desc"` |

Ordenar por `ticketPriceUsdc` dá exatamente a mesma ordem que BRL — o câmbio é único e linear,
então não há pegadinha em ordenar na moeda do banco e exibir na outra.

Junto vai o **D8**: a query da home hoje não filtra data, então "Show Retrô — Anos 80"
(março/2026) aparece sob o título "Próximos eventos". Adicionar `eventDate: { gte: now }` ao
`where` — exceto quando o usuário definiu `from`/`to` explicitamente, aí o filtro dele manda.

O `<select>` de ordenação entra no `EventFilters`, que já sabe escrever na querystring via
`setParam`. Sem estado novo.

**Arquivos.** `app/page.tsx`, `components/ui/EventFilters.tsx`
**Tamanho.** P
**Riscos.** Nenhum. `orderBy` por campo indexado; a lista já é `force-dynamic`.

### 3.2 Filtro "Perto de você" (D6)

**Como faço.** Chip novo na barra de filtros. Ao ativar, o cliente pede a localização
(`detectUserLocation()`, já existe) e grava `?near=<lat>,<lng>` na URL. O servidor, vendo `near`,
ordena por distância haversine em memória.

Antes disso, extrair a função `distanceKm` de `app/api/events/nearby/route.ts` para
`lib/geo.ts` — ela vai passar a ter três consumidores (endpoint nearby, ordenação da home,
bbox do mapa) e não pode ficar duplicada.

Se a geolocalização for negada, o chip volta ao estado inativo com uma linha de aviso — nunca
uma lista vazia sem explicação.

**Arquivos.** `lib/geo.ts` (novo), `app/api/events/nearby/route.ts`, `app/page.tsx`,
`components/ui/EventFilters.tsx`
**Tamanho.** M
**Riscos.** Ordenar em memória exige carregar os eventos ativos — hoje são 12, e o filtro de
cidade/categoria já reduz o conjunto. Vira problema na casa dos milhares, não antes.

### 3.3 Auto-scroll do carrossel (D5)

**Como faço.** `useEffect` com intervalo de **6 s** chamando o `scrollToIndex` que já existe
(ele já dá wrap para 0 no fim). Pausa em:

- `pointerenter` / `focuswithin` no container;
- `document.visibilityState === "hidden"`;
- `matchMedia("(prefers-reduced-motion: reduce)")` → não inicia.

Interação manual (seta, dot, swipe) reinicia o timer em vez de matá-lo — matar deixa o
carrossel morto pelo resto da sessão sem o usuário entender por quê.

**Arquivos.** `components/ui/Carousel.tsx`
**Tamanho.** P
**Riscos.** O `onScroll` já sincroniza o `active`, então o auto-scroll não briga com o indicador.

### 3.4 Barra de escassez colorida (D11)

**Como faço.** Ver §8 para os tons. A lógica em si: `EventCard` já recebe `availablePct` e só
renderiza a barra quando `maxTickets` existe. Trocar o `bg-ouro-500` fixo por uma função de
faixa, e **manter sempre o rótulo de texto** (`availableLabel`) — cor sozinha nunca carrega
significado, tanto por acessibilidade quanto porque é o texto que dá a informação real.

Barra só aparece com `maxTickets` definido. Pintar escassez fabricada em evento sem limite é
dark pattern e o CDC não perdoa.

**Arquivos.** `components/ui/EventCard.tsx`
**Tamanho.** P

### 3.5 Esconder pausados, rebaixar esgotados (D10)

**Como faço.** Checkbox "Mostrar pausados e esgotados" nos filtros (`?showAll=1`).

- **Pausado**: sai do `where` por padrão (`status: "ON_SALE"` em vez de `in: [ON_SALE, PAUSED]`).
- **Esgotado**: continua na query — não dá para filtrar no banco, porque "esgotado" é
  `_count.tickets >= maxTickets`, calculado depois. Vai para o fim da lista na ordenação em
  memória, **só quando `sort=date`**. Nas ordenações explícitas (alfabética, preço) o
  rebaixamento é desligado: o usuário pediu uma ordem, não cabe reordenar por cima dela.

**Arquivos.** `app/page.tsx`, `components/ui/EventFilters.tsx`
**Tamanho.** P

### 3.6 Mapa por bbox (D9)

**Como faço.** Três mudanças:

1. `/api/events/nearby` passa a aceitar `bbox=minLng,minLat,maxLng,maxLat`, filtrando com range
   de `latitude`/`longitude` direto no Prisma (mais barato que haversine, e é o filtro certo
   para "o que está na tela"). Mantém `lat`/`lng`/`radiusKm` para o filtro "perto de mim" da
   §3.2, que continua sendo por raio.
2. `EventsMapModal` ganha um componente filho com `useMapEvents({ moveend, zoomend })`,
   debounce de **400 ms**, e refetch com o bbox corrente. `AbortController` para descartar
   resposta de viewport antiga chegando fora de ordem.
3. Abertura do modal: se houver localização, centraliza nela; se não houver, centraliza no
   Brasil com zoom baixo em vez de mostrar "não conseguimos localizar você" e nada mais. Hoje,
   negar a permissão significa mapa vazio.

Clustering fica fora — com 12 eventos é otimização sem problema para resolver. Reavaliar acima
de ~200 pinos.

**Arquivos.** `app/api/events/nearby/route.ts`, `components/ui/EventsMapModal.tsx`, `lib/geo.ts`
**Tamanho.** M
**Riscos.** `moveend` dispara também no `flyTo` programático; o debounce cobre, mas vale
conferir que a centralização inicial não gere dois fetches.

### 3.7 "Anunciar" a partir de Minha Coleção (D12)

**Como faço.** Botão "Anunciar" em cada `TicketRow` de ingresso elegível (`VALID`, e
`CHECKED_IN` quando o evento já passou).

O ponto de atenção é **não duplicar o fluxo de assinatura**. Hoje ele vive inteiro dentro de
`market/page.tsx` (`handleListSubmit` → `POST /api/listings` → duas transações via provider
EIP-1193 → `PATCH /api/listings/[id]` com o txHash). Extrair para
`components/ListTicketModal.tsx`, e as duas telas passam a consumir o mesmo componente. Sem
isso, qualquer mudança no fluxo on-chain vira dois lugares para corrigir.

O destino do anúncio não precisa de código: `/api/market` separa as abas por
`eventDate < now()`, então futuro cai em Ingressos e passado em Colecionáveis sozinho.

**Arquivos.** `components/ListTicketModal.tsx` (novo), `app/my-tickets/page.tsx`,
`app/market/page.tsx`
**Tamanho.** M
**Riscos.** O gate de KYC (`code: "KYC_REQUIRED"` → `IdentityModal`) precisa viajar junto para
o componente extraído, senão o primeiro anúncio pela coleção falha em silêncio.

### 3.8 Corrigir "Você recebe" (D3)

**Como faço.** O modal de Detalhes mostra `R$ {details.priceBrl}`, que é o preço cheio. O
vendedor recebe `preço − royalty − taxa de plataforma` — hoje o número está inflado em ~18%.

A fórmula já existe e é a mesma do contrato: `computeResaleSplit` em `lib/split.ts`. Falta só o
dado: `/api/market` não devolve os bps. Adicionar `platformFeeBps`, `royaltyBps` e
`royaltyOrgShareBps` ao `select` do evento e calcular no cliente.

Exibir a quebra completa (preço anunciado → royalty do organizador → taxa da plataforma → você
recebe), não só o líquido. Transparência de taxa é promessa explícita da marca no
`BRAINSTORM.md`; mostrar o número mastigado é o mínimo.

**Arquivos.** `app/api/market/route.ts`, `app/market/page.tsx`
**Tamanho.** P
**Riscos.** Conferir que o arredondamento bate com o do contrato — `computeResaleSplit` já
existe justamente para os dois não divergirem, então usar a função e não reimplementar.

---

## 4. Onda 2 — organizador e revenda (1–2 semanas)

### 4.1 Renomear Mercado → Revenda (D1)

**Como faço.** Rota `/market` → `/revenda`, com `redirect` permanente em `next.config.ts` para
não quebrar link salvo. Trocar label no `AppShell`, `PageTitle` e textos de estado vazio.
Nomes internos de API (`/api/market`) ficam como estão — são superfície interna, e renomear rota
pública já resolve o problema de clareza.

**Arquivos.** `app/revenda/page.tsx` (movido), `next.config.ts`, `components/AppShell.tsx`
**Tamanho.** P

### 4.2 Detalhes do anúncio com analytics (D2)

**Como faço.** Em três camadas, por custo crescente:

**Camada 1 — dados que já temos, zero schema:**
- Propostas recebidas: `Negotiation` + `NegotiationRound` já guardam quem ofereceu quanto e em
  que rodada. É o sinal de precificação mais forte disponível — "3 pessoas ofereceram até
  R$ 180" diz mais que qualquer contador de views.
- Tempo no ar (`Listing.createdAt`), teto de revenda do evento, quebra de split (§3.8).

**Camada 2 — derivável, sem tabela nova:**
- Checkouts iniciados e abandonados. Não existe carrinho no produto; o análogo é
  `Purchase PENDING` que expirou e `Listing LOCKED` que voltou para `ACTIVE`. Dá para contar por
  `listingId`.

**Camada 3 — exige telemetria nova:**
- Visualizações do anúncio. Tabela `ListingEvent { listingId, type, createdAt, sessionHash }`,
  gravada por endpoint dedicado. Só depois das camadas 1 e 2, e só se elas não bastarem.

**Tamanho.** M (camadas 1–2) · P adicional (camada 3)

### 4.3 Modal step-by-step de criação de evento (D21)

**Como faço.** `components/NewEventModal.tsx` com breadcrumb de 3 passos, substituindo o
`<details>` de `organizer/page.tsx`:

1. **Informações gerais** — título, país, cidade, endereço, data (início e fim), categoria
   (multi-select) e subcategoria opcional.
2. **Dados do ingresso** — na Onda 2 entra a versão simples (preço único + quantidade + teto de
   revenda), que é o que o schema suporta hoje. A matriz completa é a Onda 3 (§5).
3. **Customizações** — line-up, vídeo, imagem, descrição, reservados, mapa. Botão "Submeter
   para aprovação" fica aqui.

Regras: validação por passo (não deixa avançar com o passo inválido), breadcrumb permite voltar
mas não pular para frente, rascunho em `localStorage` — perder um formulário de 3 passos por
refresh acidental é inaceitável.

**Importante:** o Step 2 nasce já com a forma final da UI (acordeon + tabela), mesmo que na
Onda 2 só tenha uma linha na tabela. Assim a Onda 3 preenche a estrutura em vez de refazer a tela.

**Arquivos.** `components/NewEventModal.tsx` (novo), `app/organizer/page.tsx`
**Tamanho.** M

### 4.4 Métricas na tabela de eventos (D27)

**Como faço.** Sim, a tabela atual é a lista de eventos daquele organizador
(`GET /api/organizer/events`). Colunas novas: vendidos/capacidade, check-ins realizados, receita
primária, volume de revenda e royalties recebidos.

Os royalties já estão no `LedgerEntry` (tipo `ROYALTY_PAYOUT`) e a tela já os lista embaixo —
é agregar por evento. Check-ins vêm de `Checkin` por `eventId`. Tudo em uma query agregada no
endpoint, não N+1 no cliente.

**Arquivos.** `app/api/organizer/events/route.ts`, `app/organizer/page.tsx`
**Tamanho.** M

### 4.5 Esconder Minha Coleção do organizador (D17)

**Como faço.** Condicional por `role` no `AppShell`. O caso "empresa compra ingresso" não
justifica manter a aba — ele é resolvido pela compra em nome de terceiro (§5.3).

**Arquivos.** `components/AppShell.tsx`
**Tamanho.** P

---

## 5. Onda 3 — `TicketType` (projeto próprio)

> A mudança mais cara da lista. Schema + API + checkout + **contrato**. Não deve ser misturada
> com ajuste de UI.

### 5.1 O modelo (D22, D23)

Lote, dia e área não são três coisas paralelas — são três dimensões de um mesmo objeto. Um
evento de 2 dias × 2 áreas × 3 lotes tem 12 tipos de ingresso, e é isso que precisa existir no
banco:

```prisma
model TicketType {
  id           String    @id @default(cuid())
  eventId      String
  label        String    // "Pista — Dia 1 — Lote 2"
  dayIndex     Int?      // null = passe para o evento inteiro
  areaName     String?   // null = área única
  lotNumber    Int       @default(1)
  priceUsdc    Decimal   @db.Decimal(18, 6)
  quantity     Int?      // null = ilimitado
  salesEndAt   DateTime? // fim do lote por data
  isHalfPrice  Boolean   @default(false)
  // ...
}
```

`Ticket` ganha `ticketTypeId`. **`Event.ticketPriceUsdc` sobrevive** como denormalização do
menor preço ativo ("A partir de"), para que home, carrossel e card não precisem ser reescritos
junto — é o que torna a migração incremental em vez de big bang.

**UI (D22).** Perguntas simples em acordeons (tem mais de um dia? vende por dia ou passe? tem
áreas? quantos lotes?) geram a matriz, exibida como **tabela editável** — preço e quantidade por
linha. O organizador que quer preço único nunca abre um acordeon; o que tem evento complexo *vê*
a matriz antes de submeter. Tabela é boa para revisar N linhas e ruim para descobrir opções;
acordeon é o oposto. Por isso os dois.

O escape "seu evento precisa de mais? fale com a gente" existe, mas só para cauda-longa — como
caminho principal ele exige um time de suporte que não temos.

### 5.2 Impacto no contrato

Confirmado em `smart_contracts/src/TicketSale.sol`: `struct Event` guarda **um** `ticketPrice` e
**um** `maxTickets`, e `updateMaxTickets` só permite aumentar ou zerar. Múltiplos tipos com
preços distintos não cabem no modelo atual.

Duas saídas, a decidir no início da onda:
- **(a)** `TicketType` on-chain, com `buyTicket(eventId, typeId)`. Mais correto, exige migração
  de contrato e redeploy.
- **(b)** Um `Event` on-chain por tipo de ingresso, agrupados off-chain pelo `Event` do Postgres.
  Zero mudança de contrato, ao custo de inflar a contagem de eventos on-chain e complicar o
  royalty splitter (um por tipo).

Inclinação: **(a)**, porque (b) espalha a complexidade por todo o resto do sistema para
economizar uma migração pontual. Fechar com análise de custo de gas antes de começar.

### 5.3 Compra em nome de terceiro (D18)

Campo "para quem é" no checkout (CPF ou e-mail). Se o destinatário já existe, mint na carteira
dele; se não, cria usuário pendente e a carteira Privy é provisionada no primeiro login.
Nominal desde a origem. Resolve presente, casal e família de uma vez.

**Transferência gratuita continua proibida** — é a decisão que sustenta o teto de revenda. Com
limite de N ingressos por CPF por evento, para não virar atacado disfarçado.

### 5.4 Reserva pelo organizador (D19)

`Event.reservedTickets` reduz a disponibilidade pública. O organizador depois nomeia o
beneficiário e o mint acontece pagando só a taxa da plataforma. O convidado entra pelo fluxo
normal, faz check-in normal e **ganha o colecionável** — que é a razão de existir do produto, e
o que se perderia com um código de acesso sem NFT (D20).

### 5.5 Meia-entrada (D24, D25) — ✅ implementado

- Cota por UF, não número único. A federal 12.933/2013 cobre estudante, idoso 60+, PcD (+
  acompanhante) e jovem de baixa renda do CadÚnico; **professor não está nela** — é lei estadual
  em alguns estados (SP entre eles). O mesmo organizador com evento em SP e no RJ tem obrigações
  diferentes.
- Os 40% são **teto da obrigação legal**, não piso. Travamos o campo em 40% como piso
  operacional (é a prática de mercado), mas o texto da UI não afirma que a lei exige mínimo.
- Flag `hasSocialHalf` por evento.
- **Meia não entra na revenda (D25).** É nominal e exige comprovante na portaria; revender como
  inteira quebra a lei. Decidido antes de construir justamente para não virar retrabalho.

**Como foi.** Sem esperar o modelo `TicketType` (A1 segue aberto) — anexado direto em
`Event`/`Ticket`/`Purchase`, mesmo precedente de D18/D19:

- `Event.country` (`"BR"` default) e `Event.state` (UF, opcional) — campo que não existia no
  schema; adicionado porque a cota por UF não tem como funcionar sem ele. Preenchido no Step 1
  do `NewEventModal` (select de UF; sem UF = cota do país).
- `Event.hasSocialHalf` — opt-in do organizador no Step 2, com a cota calculada exibida ao lado
  (não editável).
- `lib/socialHalfQuota.ts` — **resolve A2**: config em arquivo (`STATE_QUOTA_BPS` →
  `COUNTRY_QUOTA_BPS` → `DEFAULT_QUOTA_BPS = 4000`), não tabela no banco. Hierarquia UF → país →
  default, exatamente como pedido: se a UF do evento tem regra própria usa ela, senão cai pro
  país, senão cai pro default de 40%. Hoje nenhuma UF diverge de 40%, mas a tabela já existe
  pronta pra quando divergir, sem migration.
- `Purchase.isHalfPrice` / `Ticket.isHalfPrice` — flag que viaja do checkout até o mint
  (`webhooks/psp/route.ts` copia `purchase.isHalfPrice` pro `Ticket` criado). Preço cobrado é
  metade de `Event.ticketPriceUsdc`.
- Cota fechada em `socialHalfCap()` (`floor(maxTickets × bps / 10000)`, arredondado pra baixo) e
  checada no checkout (`sold + inFlight >= cap` → 409), mesmo padrão de `sold + inFlight` já
  usado pro teto geral e pra reserva do organizador.
- `POST /api/listings` rejeita com 409 qualquer `ticket.isHalfPrice === true`, futuro ou
  colecionável — sem exceção por status.
- **Fora do escopo desta fatia:** upload/validação de comprovante (CPF de estudante, RG de
  idoso etc.) — a exigência de apresentar documento é tratada como operação do check-in
  presencial, não do checkout. Também não há seletor de país na UI (só UF); campo existe no
  schema para o dia em que o produto sair do Brasil, mas hoje é sempre `"BR"`.

> ⚠️ Nada aqui é parecer jurídico. Validar a modelagem de cota com advogado antes do go-live.

---

## 6. Onda 4 — colecionável

### 6.1 Arte da NFT gerada (D13) — ✅ implementado

SVG server-side em `/api/metadata/[tokenId]`, montado com os dados do ingresso (evento, número,
data, selo "Você esteve lá"). Determinístico, sem storage, e o organizador pode subir arte
custom por cima.

Resolve de quebra as "imagens que parecem não renderizar" no álbum: **não é bug de render** —
3 dos 4 eventos passados do seed não têm `coverImageUrl` e caem no gradiente de fallback, e os
que têm apontam para `picsum.photos`, que exige rede.

**Como foi.** `lib/ticketArt.ts` gera o SVG (gradiente de marca por `tokenId % 3`, título,
data, número do ingresso, selo "Você esteve lá" quando há check-in). Servido publicamente em
`GET /api/tickets/[tokenId]/art.svg` (`Content-Type: image/svg+xml`), reaproveitado em dois
lugares: `image` do metadata do NFT (`coverImageUrl ?? art.svg`) e `background-image` de
`ShelfItem`/`CollectibleCard` no lugar do gradiente liso de antes — o álbum agora sempre mostra
arte de verdade, nunca um retângulo sem conteúdo.

### 6.2 Álbum de figurinhas com slot vazio (D15) — ✅ implementado

A melhor ideia da rodada, e a que nenhum concorrente tem: a figurinha *faltante* do ano em que a
pessoa não foi é um motor de demanda de colecionável.

Modelo: `Collection` (série do evento, por edição/ano) → `Slot` (conquista, preenchida ou
vazia), definidos pelo organizador. Slot vazio é renderizado como silhueta, com link para a
Revenda quando existir anúncio daquela edição.

**Como foi.** `Collection`/`Slot` novos no schema (`Slot.eventId` é `@unique` — um Event
pertence a no máximo uma Collection). **Decisão fechada em 2026-08-04**: sem auto-detecção por
título/categoria — o organizador cria a Collection e anexa Events dele manualmente
(`CollectionsManager.tsx`, seção nova em `/organizer`; API `/api/organizer/collections` +
`/api/organizer/collections/[id]/slots`). Do lado do usuário, `GET /api/me/collections` só
devolve coleções onde ele já preenche pelo menos um slot (não expõe séries de terceiros);
`CollectionShelf.tsx` (integrado ao `AlbumGrid` da view "álbum" de Minha Coleção) renderiza os
slots preenchidos com a arte do ingresso e os vazios como silhueta pontilhada, com link "Ver na
Revenda" quando existe listing ativo pra aquele evento (`/revenda?tab=collectibles`, lido via
`useSearchParams` no state inicial da aba).

### 6.3 Conquistas atestadas (D16) — ✅ implementado (off-chain)

Metadata dinâmica off-chain + hash de atestado on-chain. Escrever cada conquista na chain é caro
e irreversível; o hash dá verificabilidade pelo mesmo preço de uma escrita. Na revenda, o
anúncio exibe os troféus **com prova**.

**Como foi — escopo reduzido, decisão fechada em 2026-08-04**: só a parte off-chain. Hoje não
existe nenhum campo de hash em `TicketNFTLocked.sol` — gravar on-chain exigiria função +
storage novos e redeploy do contrato, e (mesmo racional de A1 na Onda 3) esse custo não foi
avaliado ainda, então não escrevemos nada on-chain nesta fatia. Em vez disso,
`hashAchievements()` (`lib/achievements.ts`) computa um digest sha256 determinístico sobre as
conquistas alcançadas + wallet; qualquer um pode recomputar `computeAchievements(wallet)` a
partir de dados já públicos (`Checkin`/`Ticket`) e conferir que o hash bate — é uma prova
verificável, só que sem escrita em chain. Exposto em `GET /api/me/album` (`achievementsHash`) e,
pra colecionáveis, em `GET /api/market` (`sellerAchievements` + `sellerAchievementsHash` por
listing) — a Revenda mostra os troféus do vendedor com o hash no tooltip. Se decidirmos migrar
pra on-chain depois, o hash já calculado aqui é exatamente o que iria pro contrato.

### 6.4 Voucher de consumo (D4) — ⏸️ adiado deliberadamente

`EventExtra` (item vendido pelo organizador) + voucher amarrado ao ingresso NFT, queimado pelo
mesmo QR rotativo do check-in — o QR já existe; o que falta é o POS do operador.

**Voucher de item, não saldo em reais.** A diferença regulatória é enorme: voucher é venda de
produto, saldo é moeda. Além disso o dinheiro fica em custódia até o evento (você vira
depositário), a nota fiscal do alimento é do organizador, e crédito não-reembolsável esbarra no
CDC.

**Decisão do produto, fechada em 2026-08-04: não construir agora.** Não é falta de tempo — é
que ainda não validamos que o mercado (organizador + público) quer essa funcionalidade, e nessa
forma específica (voucher de item, não crédito). Construir antes de validar arrisca meses de
trabalho — POS do operador, conciliação com PSP, nota fiscal do organizador — em cima de uma
hipótese não testada. Quando houver essa validação, o desenho acima (voucher de item, QR
reaproveitado) segue sendo o ponto de partida; nada aqui foi descartado, só adiado.

---

## 7. Em aberto

| # | Questão | Bloqueia |
|---|---|---|
| A1 | `TicketType` on-chain (5.2a) vs. um evento on-chain por tipo (5.2b) — decidir com custo de gas na mesa. | Início da Onda 3 |
| ~~A2~~ | ~~Fonte da configuração de cota de meia por UF~~ — **fechado em 2026-08-04**: arquivo de config (`lib/socialHalfQuota.ts`), hierarquia UF → país → default. Ver §5.5. | — |
| A3 | Custódia e conciliação do voucher de consumo — qual PSP, e o que acontece com voucher não usado. | §6.4 |
| A4 | Formato do modelo 3D (glTF? qual peso máximo?) e onde hospedar. | D14 |
| A5 | Biblioteca de clustering do mapa, se e quando passar de ~200 pinos. | §3.6 |

---

## 8. Apêndice — cor da barra de escassez (D11)

**Sem vermelho.** O `DESIGN_SYSTEM.md` (§ cores de estado) é explícito: as cores de estado foram
derivadas *"evitando verdes e vermelhos saturados de dashboard genérico, que brigam com Laranja e
Ouro"*. Usar `--color-erro` (`#C4392A`) numa barra de card seria exatamente a discrepância que o
sistema evita — e escassez não é erro.

A escala usa a rampa quente da marca e termina em **Violeta**, que é cor de marca, tem tom claro
e chamativo, e destaca sobre a superfície escura sem brigar com nada:

| Disponibilidade | Token | Hex | Leitura |
|---|---|---|---|
| > 50% | `bg-ouro-500` | `#C79A4A` | neutro — igual a hoje |
| 20–50% | `bg-laranja-400` | `#FF8C3F` | atenção |
| < 20% | `bg-violeta-300` | `#A87BD8` | últimos ingressos |

Notas de implementação:

- A trilha da barra continua `bg-surface-2` (`#1B2743`). Violeta-300 sobre ela tem contraste
  alto — o "tom claro chamativo" que queremos.
- **Não compete com o CTA.** O botão do card é outline (`border-border-strong`), não preenchido
  de laranja, então nenhuma das três faixas disputa atenção com a ação.
- A barra vive no corpo do card (`bg-surface`), nunca sobre a miniatura — então não há risco de
  o violeta se perder no `--grad-profundidade` do fallback de capa.
- **Cor nunca é o único portador de significado.** O rótulo (`availableLabel`, ex.: "Últimos 18
  de 500 disponíveis") continua obrigatório sempre que a barra aparecer.
- A escala não é monotônica em "temperatura" (ouro → laranja → violeta não é uma rampa de calor
  contínua), então o texto é o que carrega a direção da escala. É mais uma razão para o rótulo
  ser obrigatório, e não um argumento contra o violeta.
