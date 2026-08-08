# Tessera — Plano de Evolução V2

> **Status:** aprovado, em execução · **Aberto em:** 2026-08-03 · **Última revisão:** 2026-08-07 (Onda 6, §10)
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
- **§9** é a Onda 5, aberta na revisão de layout de 2026-08-06: três bugs de superfície e a
  reformulação do álbum em formato de página.
- **§10** é a Onda 6, aberta em 2026-08-07: conformidade legal (revenda, meia-entrada) e o
  desenho de cortesia/reserva do organizador. É a onda com mais risco jurídico do documento.
  O **como** dela (ordem, migrations, endpoints, componentes) vive em `PLANO_DEV_ONDA6.md`.

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
| D19 | Reserva de ingressos pelo organizador | No nível de **oferta** (`Event.reservedTickets`), não de mint antecipado. O convidado passa pelo fluxo normal e ganha o colecionável. → **Mantido, ampliado por D40**: o desenho está certo; só a exigência de `maxTickets` para *nomear beneficiário* era efeito colateral da implementação. | 3 |
| D20 | Código de acesso sem NFT | ~~**Adiado.**~~ **Destravado por D41 em 2026-08-07** — o mérito continua de pé: código não dá colecionável. Só que isso é a *definição* do código, não um defeito dele; quem dá colecionável é a reserva (D40), e as duas coexistem. Ver §10.5. | 6 |
| D21 | Criação de evento | Modal **step-by-step** com breadcrumb de 3 passos, substituindo o `<details>` atual. | 2 |
| D22 | Step 2 (dados do ingresso) | **Híbrido acordeon + tabela**: perguntas simples geram a matriz de tipos de ingresso, exibida como tabela editável. Escape "fale com a gente" só para cauda-longa. | 3 |
| D23 | Modelo de dados de ingresso | Novo `TicketType` (área × dia × lote). `Event.ticketPriceUsdc` vira denormalização do menor preço, para não reescrever home/carrossel. **Toca o contrato.** | 3 |
| D24 | Meia-entrada | Cota **configurável por UF**, não número único: a lei federal 12.933/2013 não cobre professor (é lei estadual em alguns estados). ~~Os 40% são teto da obrigação; o campo trava em 40% como piso operacional, mas o texto da UI não afirma que a lei exige mínimo.~~ → **Corrigido por D38**: em evento coberto os 40% **são** piso legal, não escolha operacional. | 3 |
| D25 | Meia-entrada na revenda | **Ingresso de meia não entra na revenda.** É nominal e exige comprovante na portaria; revender como inteira quebra a lei. | 3 |
| D26 | Teto de revenda | **Mantido como está**: `maxResaleBps` incide sobre `Ticket.facePrice` (por ingresso). Não mudar para "preço do ingresso mais caro" — quem comprou lote 1 barato não deve poder revender no teto do lote 3. | — |
| D27 | Métricas na tabela do organizador | Sim: vendidos/capacidade, check-ins, receita primária, volume de revenda e royalties. | 2 |
| D28 | Navegação para visitante anônimo | Header mostra **só Eventos e Revenda** sem sessão. Itens de conta (Minha Coleção e os já gateados por role) só aparecem logado. **Revoga a decisão registrada em §4.5**, que mantinha Minha Coleção visível para anônimo. | 5 |
| D29 | CTA "Ver revenda" do evento esgotado | **É bug.** O card inteiro é um `<Link>` para `/events/[id]`; o CTA é um `<span>` dentro dele, então clicar leva para o evento, não para a Revenda. Vale para home, carrossel e mapa. A página do evento esgotado não tem CTA nenhum — só o badge. | 5 |
| D30 | Cards da aba Colecionáveis | **É bug de layout**, não de conteúdo: o rodapé (preço + Propor + Comprar) não cabe na coluna do grid e é cortado pelo `overflow-hidden` do card. | 5 |
| D31 | Visualização de lista em Minha Coleção | **Mantida, mas reduzida a "Próximos"**: só ingressos de eventos futuros. O que já aconteceu vive no álbum. Remover a lista inteira custaria o entry point de "Anunciar" (D12), que hoje só existe em linha. | 5 |
| D32 | Álbum como álbum de verdade | O álbum passa a ser **paginado**: cada `Collection` do organizador é uma página; ingressos passados fora de qualquer Collection caem na página do ano; ingressos de eventos futuros são **figurinhas soltas**, com o layout de grade de hoje. | 5 |
| D33 | Slot vazio | Ganha arte própria (gradiente da marca + quadrifólio esmaecido) e **placeholder dizendo que ingresso seria aquele** — nome da edição, data e cidade. Silhueta cinza sem informação não gera desejo; o slot precisa nomear o que falta. | 5 |
| D34 | Virada de página do álbum | Animação de folhear (rotação em 3D no eixo da lombada, ~450 ms), desligada sob `prefers-reduced-motion`. | 5 |
| D35 | Data do evento | Passa a ter **início e fim** (`eventDate` + `endDate`), ambos obrigatórios no Step 1. Hoje só existe o início, e "quando o evento acabou" é adivinhado por ele — o que decide se um ingresso virou colecionável. | 6 |
| D36 | Teto de revenda — o que a lei exige | **A premissa de "100% por lei" só vale para esporte.** Revenda acima do valor impresso é crime pelo art. 166 da Lei Geral do Esporte (14.597/2023) — **só para evento esportivo**. Para show/teatro/festival **não há tipo penal federal**; o risco é CDC (prática abusiva) e Lei 1.521/51 art. 4º (economia popular) quando há especulação. Logo: `ESPORTE` trava em 10000 bps; nas demais categorias 100% vira **default de produto**, não imposição legal. | 6 |
| D37 | Cobrir as taxas do vendedor | **Não subindo o preço.** Vender acima da face para o vendedor receber 100% faz o *comprador* pagar acima da face — que é exatamente a conduta vedada. O caminho lícito é **reduzir as deduções**: a plataforma zera a própria taxa quando o anúncio está no teto. Ver §10.2. | 6 |
| D38 | Meia-entrada é obrigatória por categoria | **Corrige D24.** Em evento artístico-cultural ou esportivo a Lei 12.933/2013 **assegura** a meia em 40% dos ingressos — é cota mínima obrigatória, não teto opcional. `SHOW`, `FESTIVAL`, `TEATRO`, `ESPORTE` passam a ter meia obrigatória com piso de 40%. | 6 |
| D39 | UI da meia-entrada | Com `maxTickets`: **slider** de percentual (o organizador pode oferecer mais que a cota legal). Sem `maxTickets`: **checkbox** (não há total sobre o que calcular percentual). Em categoria coberta, o slider trava o mínimo em 40% e o checkbox nasce marcado e desabilitado. | 6 |
| D40 | Reserva de ingresso | Segue como D19 desenhou (cota na criação, beneficiário nomeado depois, **com colecionável**) — é o presente cheio. Destrava o que a implementação bloqueou sem querer: **nomear beneficiário e bancar o mint passa a funcionar sem `maxTickets`**; só a cota de vagas continua exigindo teto, porque só ela depende de escassez. | 6 |
| D41 | Código de entrada | **D20 volta ao escopo, com o argumento dele intacto.** O código dá **só entrada**, sem NFT — e isso é a definição dele, não uma perda. **Não compete com D40**: reserva é presente com colecionável, decidido na criação; código é entrada avulsa, gerado depois na tabela de eventos, N limitado pelas vagas disponíveis. | 6 |
| D42 | Conta de lotação | **Fonte única obrigatória** antes de D41. Exibição e checkout hoje usam fórmulas diferentes (a exibição ignora `inFlight`), então a home já mente sobre disponibilidade. `publicAvailability` passa a receber um `CapacityUsage` de quatro parcelas, e a emissão de código é transacional com lock no evento. Ver §10.6. | 6 |
| D43 | O que o código é | **Segredo aleatório ao portador**, não hash nem payload HMAC: 10 caracteres em Crockford Base32, globalmente único, `randomBytes`, servindo como texto digitável e como QR. Guardado em plaintext (o painel precisa re-listar) com rate limit no check-in. E **entrada por código vira `AccessEntry`, não `Checkin`** — `Checkin.tokenId` exige `Ticket`, que a entrada por código não tem. | 6 |

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

> ⚠️ **Parcialmente revogado por D28 (§9.1).** O racional escrito aqui — exclusão pontual do
> organizador, mantendo a aba visível para visitante anônimo — valeu até 2026-08-06. A regra de
> role continua; o que mudou é que anônimo também deixa de ver Minha Coleção.

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
  id                      String    @id @default(cuid())
  eventId                 String
  onchainTypeId           Int?      // typeId em TicketSale.sol (§5.2); null até a aprovação do evento
  label                   String    // "Pista — Dia 1 — Lote 2"
  dayIndex                Int?      // null = passe para o evento inteiro
  areaName                String?   // null = área única
  lotNumber               Int       @default(1)
  priceUsdc               Decimal   @db.Decimal(18, 6)
  quantity                Int?      // null = ilimitado — espelha TicketType.maxTickets do contrato
  salesEndAt              DateTime? // fim do lote por data

  // Meia-entrada por tipo (A6) — mesmo desenho de Event.hasSocialHalf/reservedTickets
  // hoje, só que por tipo em vez de global.
  hasSocialHalf           Boolean   @default(false)

  // Reserva do organizador por tipo (A7) — "reservo 20 do Camarote", não 20 do evento.
  reservedTickets         Int       @default(0)
  reservedTicketsAssigned Int       @default(0)
  // ...
}
```

`Ticket` ganha `ticketTypeId`; `Ticket.facePrice` passa a vir de `TicketType.priceUsdc` no
momento da compra, não de `Event.ticketPriceUsdc`.

**`Event.ticketPriceUsdc` sobrevive** como denormalização do menor preço **ativo** ("A partir
de"), para que home, carrossel e card não precisem ser reescritos junto — é o que torna a
migração incremental em vez de big bang. "Ativo" tem uma regra fechada em 2026-08-04 (A8):
exclui tipo esgotado (`quantity` atingida) e tipo com `salesEndAt` vencido — do contrário a home
anunciaria "a partir de R$ X" de um lote que não vende mais, o que é propaganda enganosa, não só
uma UI desatualizada. Recalculado em dois gatilhos: a cada compra que esgota um `TicketType`, e
por um job que varre `salesEndAt` vencidos (não existe hoje; nasce com esta fatia).

**Meia-entrada (A6) e reserva do organizador (A7) migram de `Event` para `TicketType`.**
Hoje ambos são campos globais do evento (`Event.hasSocialHalf`, `Event.reservedTickets` +
`reservedTicketsAssigned`, calculados via `socialHalfCap()` sobre `Event.maxTickets`). Com N
tipos de preço diferente, mantê-los globais abre duas brechas:
- **Meia global + preço por tipo é arbitragem.** O comprador de meia escolhe racionalmente o
  tipo mais caro disponível — a plataforma paga a diferença sem o organizador ter pedido isso.
- **Reserva global não expressa o que o organizador quer.** "Reservo 20 ingressos" sem dizer de
  qual área ou lote não é a intenção real; o organizador pensa em "20 do Camarote", não em uma
  cota vaga que se encaixa em qualquer tipo.

Os dois migram para `TicketType`, mantendo o mesmo mecanismo (`socialHalfCap()` passa a operar
sobre `TicketType.quantity`; `reservedTickets`/`reservedTicketsAssigned` reaproveitam o padrão
`sold + inFlight` já usado no checkout — só trocam de nível). `Event.hasSocialHalf` e
`Event.reservedTickets` somem do schema nesta migração.

**UI (D22).** Perguntas simples em acordeons (tem mais de um dia? vende por dia ou passe? tem
áreas? quantos lotes?) geram a matriz, exibida como **tabela editável** — preço e quantidade por
linha. O organizador que quer preço único nunca abre um acordeon; o que tem evento complexo *vê*
a matriz antes de submeter. Tabela é boa para revisar N linhas e ruim para descobrir opções;
acordeon é o oposto. Por isso os dois.

O escape "seu evento precisa de mais? fale com a gente" existe, mas só para cauda-longa — como
caminho principal ele exige um time de suporte que não temos.

**Fatia atual — ✅ implementada (schema + backend, sem UI de matriz).** `TicketType` existe no
Postgres com o formato acima menos `dayIndex`/`areaName`/`lotNumber` (adiados pra quando a UI de
matriz existir — cada campo novo é migração, então só entram quando têm consumidor). Todo evento
nasce com **exatamente um** `TicketType`, criado junto do `Event` em
`POST /api/organizer/events` e espelhando `ticketPriceUsdc`/`maxTickets` — o organizador continua
preenchendo os mesmos dois campos de sempre no Step 2; é o backend que passou a modelá-los como
uma matriz de um elemento. Editar o evento antes da aprovação (`PATCH .../[id]`) sincroniza o
tipo junto, pra não ficar desatualizado em relação ao que vai para o contrato.

A aprovação (`POST /api/admin/events/[id]/approve`) monta `TicketTypeInput[]` a partir de
`event.ticketTypes` (ordenados por `createdAt`, mesma ordem que o `typeId` on-chain nasce) e
chama `createEventOnChain(event, types)` — o `createEvent` que já existia desde a fatia do
contrato (§5.2), só que agora alimentado pelo Postgres em vez de sintetizar um tipo a partir de
`Event.ticketPriceUsdc`. Os `typeId` retornados voltam para `TicketType.onchainTypeId` na mesma
transação que marca o evento `ON_SALE`.

O checkout (`POST /api/events/[id]/checkout`) resolve o `TicketType` do evento e grava
`Purchase.ticketTypeId`; o preço cobrado passa a vir de `TicketType.priceUsdc`, não mais de
`Event.ticketPriceUsdc` — hoje são sempre o mesmo número, mas a fonte da verdade já é a certa
para quando deixarem de ser. O webhook do PSP lê `purchase.ticketType.onchainTypeId` para saber
qual tipo comprar on-chain (antes era `0` fixo) e grava `Ticket.ticketTypeId`; se o tipo ainda não
foi aprovado on-chain, reembolsa em vez de adivinhar — mesmo padrão defensivo já usado para
`Event.onchainEventId === null`. O indexer (rede de segurança quando o webhook não roda) resolve
o mesmo vínculo a partir do `typeId` do próprio log `TicketSold`.

**Fora desta fatia, de propósito:** a UI de matriz (acordeon + tabela) continua não existindo —
o organizador não vê múltiplos tipos em lugar nenhum, só o preço único de sempre. Meia-entrada
(A6) e reserva do organizador (A7) continuam vivendo em `Event`, não migraram para `TicketType`
ainda — o checkout de hoje só lida com um tipo por evento, então mover esses campos agora criaria
uma segunda fonte da verdade sem nenhum consumidor. E "menor preço ativo" (A8) não tem o que
fazer: com um tipo só, `Event.ticketPriceUsdc` já é o próprio preço, não uma denormalização — o
recálculo por `salesEndAt`/esgotamento só ganha sentido quando existir mais de um tipo para
escolher entre eles.

### 5.2 Impacto no contrato — ✅ decidido e implementado (opção **a**)

Confirmado em `smart_contracts/src/TicketSale.sol`: `struct Event` guardava **um** `ticketPrice` e
**um** `maxTickets`, e `updateMaxTickets` só permitia aumentar ou zerar. Múltiplos tipos com
preços distintos não cabiam no modelo antigo.

Duas saídas estavam na mesa:
- **(a)** `TicketType` on-chain, com `buyTicket(eventId, typeId)`. Mais correto, exige migração
  de contrato e redeploy.
- **(b)** Um `Event` on-chain por tipo de ingresso, agrupados off-chain pelo `Event` do Postgres.
  Zero mudança de contrato, ao custo de inflar a contagem de eventos on-chain e complicar o
  royalty splitter (um por tipo).

**Fechado em 2026-08-04: (a).** Dois fatos decidiram, e nenhum dos dois é "gas de compra" — o
custo por ingresso vendido é praticamente igual nas duas:

1. **O custo de migração de (a) é ~zero hoje.** `smart_contracts/broadcast/Deploy.s.sol/` só tem
   `31337/` — Anvil local. Não há deploy em testnet nem mainnet, nenhum holder para migrar,
   nenhum `tokenId` em produção. O redeploy que o argumento de (b) evitava custa rodar o
   `Deploy.s.sol` e reescrever o `.env`. Esse custo **só nasce depois do go-live** — comparar
   (a) pelo preço futuro contra (b) pelo preço de hoje era o viés que segurava a decisão errada.
2. **(b) deploya um `RoyaltySplitter` por tipo.** `createEvent` faz `new RoyaltySplitter(...)`
   e grava o endereço como `royaltyReceiver` de cada NFT. Um evento de 2 dias × 2 áreas × 3
   lotes viraria **12 splitters idênticos** — o deploy de contrato é o item mais caro da
   criação — e o organizador passaria a sacar royalty de 12 endereços, o que contamina o
   `LedgerEntry`/`ROYALTY_PAYOUT` e as métricas do §4.4. Em (a) o splitter continua sendo um
   por evento.

Também ficou registrada a opção tentadora que **não** existe: *"não mexer no contrato, deixar
`Event.ticketPrice` como preço de referência e controlar o tipo só no Postgres"*. Isso quebra o
**D26** — `MintParams.facePrice` recebia `ev.ticketPrice`, e o `facePrice` gravado no NFT é a
âncora do teto de revenda. Todos os tipos mintando com o mesmo `facePrice` deixaria quem comprou
o Lote 1 revender no teto do Lote 3.

**Como foi.** `TicketSale.sol`:

- `struct TicketType { price, maxTickets, soldTickets, salesEndAt, paused, label }` em
  `mapping(uint256 => mapping(uint256 => TicketType)) ticketTypes`, com `ticketTypeCount` por
  evento.
- `Event` **perde** `ticketPrice` e `defaultSeat` (foram para o tipo) e **mantém** `maxTickets`
  como teto global do evento e `soldTickets` como contador global — é ele que numera o ingresso
  `#N de M`, que o metadata do NFT e a arte do colecionável (§6.1) já assumem.
- `createEvent(..., TicketTypeInput[] types)` cria evento **e** matriz inteira numa única
  transação. É isso que mantém a aprovação atômica: em (b), falhar na 7ª de 12 transações
  deixaria 6 eventos órfãos on-chain que o `catch` do approve (que só mexe no Postgres) não
  reverte. `addTicketType` cobre abrir lote novo depois.
- `buyTicket(eventId, typeId)` / `buyTicketFor(eventId, typeId, recipient)`. O `facePrice` do
  mint passa a ser `type.price` — **é o que preserva o D26**. O `seat` do NFT passa a ser
  `type.label` ("Pista — Dia 1 — Lote 2").
- Cota dupla: o tipo tem a sua (`Ticket type sold out`) e o evento tem o teto global
  (`Sold out`). As cotas dos tipos **podem somar mais que o teto global de propósito** — é o
  caso de lotes sequenciais da mesma área, onde somar as cotas contaria a mesma cadeira 3 vezes.
- `toggleTicketTypePause`, `updateTicketTypeMax` (só aumenta ou zera, mesma regra do teto
  global) e `updateTicketTypeSalesEnd` (só estende ou limpa — para fechar antes existe o pause,
  que é explícito).
- `TicketSold` ganha `typeId`; `EventCreated` perde `price` (não existe mais um preço do evento)
  e nasce `TicketTypeAdded`.

`TicketNFT`, `TicketResale` e `TicketSwap` **não foram tocados** — trabalham sobre `tokenId` e
`royaltyInfo()`, cuja forma não mudou.

Off-chain, só o encanamento para o app continuar funcionando igual: `abis.ts`, `onchain.ts`
(`createEventOnChain` recebe `types?` opcional e, sem eles, cria um tipo único a partir de
`Event.ticketPriceUsdc` — comportamento idêntico ao de hoje; novo `addTicketTypeOnChain`;
`buyTicketOnChain` ganha `typeId`) e o webhook do PSP, que passa `0` fixo até existir o
`TicketType` do Postgres. O indexer passou a gravar `facePrice` a partir do `amount` do próprio
log em vez de `event.ticketPriceUsdc` — com N tipos o preço do `Event` é só a denormalização do
menor ("a partir de"), e usá-lo gravaria a âncora de revenda errada.

**Fora desta fatia:** o modelo `TicketType` do Prisma, `Ticket.ticketTypeId`, o checkout por tipo
e a UI acordeon + tabela do §5.1. O contrato agora suporta a matriz; o Postgres ainda não a
representa. É a próxima fatia da Onda 3.

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
| ~~A1~~ | ~~`TicketType` on-chain (5.2a) vs. um evento on-chain por tipo (5.2b)~~ — **fechado em 2026-08-04: opção (a)**, implementada em `TicketSale.sol`. Decidiram o custo ~zero de migração enquanto só existe deploy Anvil, e o `RoyaltySplitter` por tipo que (b) provocaria. Ver §5.2. | — |
| ~~A2~~ | ~~Fonte da configuração de cota de meia por UF~~ — **fechado em 2026-08-04**: arquivo de config (`lib/socialHalfQuota.ts`), hierarquia UF → país → default. Ver §5.5. | — |
| A3 | Custódia e conciliação do voucher de consumo — qual PSP, e o que acontece com voucher não usado. | §6.4 |
| A4 | Formato do modelo 3D (glTF? qual peso máximo?) e onde hospedar. | D14 |
| A5 | Biblioteca de clustering do mapa, se e quando passar de ~200 pinos. | §3.6 |
| A9 | Teto de slots por folha do álbum (~12?) e o que acontece com coleção maior: paginar em duas folhas ou rolar dentro da folha. Rolar dentro da folha mata a metáfora; paginar exige numeração composta ("Rock in Rio — 1 de 2"). | §9.4.2 |
| A10 | Onde a arte do slot vazio vem quando o organizador definiu arte custom da coleção (`Collection.coverImageUrl` existe no schema e não é usado por ninguém hoje) — usar como fundo esmaecido do slot vazio ou só como capa da página? | §9.4.2 |
| A11 | **Parecer jurídico:** taxa de serviço destacada por cima da face na revenda (espelhando a taxa de conveniência do primário) conta como "preço superior ao estampado" para o art. 166 da Lei Geral do Esporte? Em esporte o downside é criminal, então só com parecer. Nas demais categorias, é o que decide se o vendedor consegue fechar em 100% líquido sem a plataforma abrir mão da taxa. | §10.2 |
| A12 | `CONFERENCIA` e `OUTRO` entram em "espetáculos artístico-culturais e esportivos" da Lei 12.933/2013? O texto cita "eventos educativos, esportivos, de lazer e de entretenimento", o que é largo o bastante para cobrir quase tudo. Definir com advogado antes de travar a UI. | §10.3 |
| A13 | Custo de plataforma da cortesia (D40): o organizador paga quanto por ingresso bancado? Zero, taxa fixa, ou o `platformFeeBps` sobre a face? Sem isso, cortesia em massa vira mint gratuito ilimitado às nossas custas de gas. | §10.5 |
| ~~A6~~ | ~~Meia-entrada com `TicketType`: cota/preço por tipo ou globais do evento?~~ — **fechado em 2026-08-04: por tipo.** Global abriria arbitragem: todo comprador de meia escolheria racionalmente o tipo mais caro disponível, e o organizador levaria um rombo de receita sem ter feito nada errado. `Event.hasSocialHalf`/cap migram para `TicketType`; `getSocialHalfQuotaBps` (UF→país→default) não muda, só passa a aplicar sobre `TicketType.maxTickets` em vez de `Event.maxTickets`. | Schema da Onda 3 |
| ~~A7~~ | ~~Reserva do organizador (D19) com `TicketType`: por tipo ou global?~~ — **fechado em 2026-08-04: por tipo.** "Reservo 20 ingressos" sem dizer de qual área/lote não corresponde ao que o organizador quer dizer na prática. `reservedTickets`/`reservedTicketsAssigned` migram para `TicketType`, mesmo padrão `sold + inFlight` já usado no checkout. | Schema da Onda 3 |
| ~~A8~~ | ~~`Event.ticketPriceUsdc` como "menor preço ativo": inclui tipo esgotado/vencido?~~ — **fechado em 2026-08-04: exclui.** Contar tipo esgotado ou com `salesEndAt` vencido anunciaria "a partir de R$ X" de um lote que não vende mais — propaganda enganosa, não só desatualização cosmética. Recalculado (`min(price)` sobre tipos com `soldTickets < maxTickets` e `salesEndAt` futuro ou nulo) a cada compra que esgota um tipo e por um job que varre `salesEndAt` vencidos — não é só um campo, é um serviço. | Schema da Onda 3 |

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

---

## 9. Onda 5 — correções de layout e álbum paginado

> Aberta na revisão de layout de **2026-08-06**. §9.1 a §9.3 são bugs de superfície, cada um de
> horas. §9.4 é a reformulação do álbum, e é o item de verdade desta onda.

### 9.1 Header sem sessão mostra só Eventos e Revenda (D28)

**Decisão.** Visitante anônimo vê **Eventos** e **Revenda**, mais nada. Minha Coleção some junto
com Organizador, Admin e Check-in.

Isso **revoga o racional escrito em §4.5**, que mantinha Minha Coleção visível para `role === null`
com o argumento de que "a página já sabe lidar com faça login sozinha". Ela sabe — mas oferecer no
header uma aba que só entrega uma tela de login é ruído na primeira visita, que é exatamente o
momento em que a navegação precisa dizer o que o produto faz. Descobrir a coleção é consequência de
ter comprado, não de ter chegado.

**Como faço.** `NAV_ITEMS` ganha `requiresAuth?: boolean` em vez de mais uma exclusão pontual —
a filtragem de hoje já mistura dois mecanismos (allowlist por `roles` + um `!(href === "/my-tickets"
&& role === "ORGANIZER")` avulso) e um terceiro caso hardcoded deixaria a regra ilegível:

```ts
{ href: "/my-tickets", label: "Minha Coleção", requiresAuth: true }
```

O filtro passa a ser: `(!item.requiresAuth || signedIn) && (!item.roles || …) && !(my-tickets &&
ORGANIZER)`, com `signedIn = ready && authenticated`.

**O ponto de atenção é o flash.** Enquanto `ready === false` o Privy ainda não sabe se há sessão;
tratar isso como "não logado" faz Minha Coleção aparecer um frame depois em todo carregamento de
página logada. Como `signedIn` já exige `ready`, o item nasce escondido e entra quando a sessão
resolve — que é a direção certa: item aparecendo é menos violento que item sumindo debaixo do
cursor. Mesma regra vale para o rodapé da home, que hoje lista Minha Coleção e Organizador em
`<Link>` fixo, sem nenhum gate.

**Arquivos.** `app/components/AppShell.tsx`
**Tamanho.** P
**Riscos.** Nenhum funcional — o gate é de navegação, não de autorização; `/my-tickets` continua
protegida por `getAuthUser` no servidor.

### 9.2 CTA "Ver revenda" do evento esgotado (D29)

**O bug.** `EventCard` é um `<Link href={/events/[id]}>` que embrulha o card inteiro, e o CTA é um
`<span>` dentro dele (`EventCard.tsx:113`). Quando o evento está esgotado, `page.tsx:293` troca o
rótulo para "Ver revenda" — mas só o rótulo. O destino continua sendo a página do evento. O mesmo
vale para o carrossel (`Carousel.tsx:107`, `ctaLabel: "Ver na revenda"`) e para os cards do modal
do mapa (`EventsMapModal.tsx:164`). Três superfícies, um bug só: **o texto promete um destino que
o elemento não tem**.

Na página do evento (`events/[id]/page.tsx:166`) o problema é outro: esgotado renderiza um
`<Badge variant="error">Esgotado</Badge>` e para por aí. O usuário que chegou até a página de compra
é o mais qualificado que existe, e a única coisa oferecida a ele é a informação de que não dá.

**Como faço.** Três mudanças, em ordem:

1. **`EventCard` ganha `ctaHref?: string`.** Quando presente, o CTA deixa de ser `<span>` e vira
   `<Link href={ctaHref}>` com `onClick={(e) => e.stopPropagation()}` — link aninhado dentro de link
   é HTML inválido e o comportamento varia por navegador, então o CTA sai de dentro do `<Link>`
   externo e o card inteiro passa a usar um *stretched link* (`<Link>` posicionado com
   `absolute inset-0` sobre a área do card, `z-0`; o CTA fica em `z-10`). É o padrão que mantém "o
   card todo é clicável" sem aninhar âncoras.
2. **Home, carrossel e mapa** passam `ctaHref` quando `soldOut`.
3. **Página do evento**: além do badge, botão secundário "Ver na revenda" com o mesmo destino.

**O destino.** `/revenda?tab=tickets&event=<id>`. Mandar para `/revenda` puro seria trocar um
clique errado por uma lista de todos os anúncios da plataforma, onde o evento que a pessoa queria
pode nem estar visível. Isso exige duas coisas que ainda não existem:

- `GET /api/market` aceitar `event=<id>` (`where.ticket.eventId`). A rota hoje só lê `tab`
  (`api/market/route.ts:12`).
- `/revenda` ler o parâmetro, aplicar no fetch e mostrar um chip **"Filtrando: <título do evento> ✕"**
  acima da lista. Sem o chip, uma lista curta parece uma Revenda vazia e o usuário vai embora
  achando que não há oferta nenhuma na plataforma.

E o estado vazio precisa de texto próprio: "Ninguém está revendendo ingresso para este evento
ainda." — diferente de "Nenhum ingresso à venda no momento", que hoje é a mensagem global.

**Arquivos.** `components/ui/EventCard.tsx`, `components/ui/Carousel.tsx`,
`components/ui/EventsMapModal.tsx`, `app/page.tsx`, `app/events/[id]/page.tsx`,
`app/api/market/route.ts`, `app/revenda/page.tsx`
**Tamanho.** P (M contando o filtro por evento)
**Riscos.** O *stretched link* muda a área clicável do card — conferir que o badge de data, o badge
de status e a barra de escassez continuam fora do caminho do foco por teclado, e que o card
continua tendo **um** alvo de tab (o link do card) mais o CTA, não um por elemento.

### 9.3 Cards da aba Colecionáveis (D30)

**O bug.** Não é o `CollectibleCard` em si — é o rodapé que a `/revenda` injeta como `children`
(`revenda/page.tsx:395`): `flex items-center gap-2` com o preço (`$48.00 USDC`, `font-bold
tabular-nums`) e, à direita, `Propor` + `Comprar`. A largura intrínseca mínima dessa linha é maior
que a coluna do grid em `lg:grid-cols-3`, e como `CollectibleCard` é `overflow-hidden`
(`CollectibleCard.tsx:25`), o excesso não vaza: é **cortado**. É exatamente o que a imagem mostra —
"Compra[r]" desaparecendo na borda direita e o preço quebrando em duas linhas (`$90.00` / `USDC`)
porque o flex espremeu o span até o limite.

A aba Ingressos não sofre disso porque usa `Panel` em largura total, não grid de 3 colunas. O
componente nunca foi exercitado na largura em que vive.

**Como faço.** O rodapé precisa parar de assumir que cabe em uma linha:

- Preço e botões em **duas linhas** dentro do card: preço com `≈ R$` embaixo (a aba Ingressos já
  mostra o valor em BRL — `revenda/page.tsx:433` — e o colecionável não; a paridade é de graça
  aqui), e os botões numa linha própria com `grid grid-cols-2 gap-2`, cada um ocupando metade.
  Dois botões de largura igual num card estreito leem melhor que dois botões encolhidos empurrados
  para a direita.
- `min-w-0` no wrapper e `truncate` no preço, para que o card nunca mais possa ser a causa de um
  overflow — cinto de segurança, não a correção em si.
- A linha de troféus (`revenda/page.tsx:387`) tem o mesmo defeito latente: ícones + "troféus do
  vendedor · com prova" em `flex items-center` sem `flex-wrap`. Ganha `flex-wrap` e o texto vai
  para a segunda linha em vez de espremer os ícones.
- `meta` do card hoje é `venue · cidade · Ingresso #N` numa string só, e quebra em duas linhas em
  um card e não no outro — cabeçalhos de altura diferente entre cards vizinhos. Separar em duas
  linhas fixas (local numa, `Ingresso #N` noutra) dá altura previsível.

Não mexer em `lg:grid-cols-3`: a coluna é larga o suficiente, o rodapé é que estava mal montado.

**Arquivos.** `app/revenda/page.tsx`, `components/ui/CollectibleCard.tsx`
**Tamanho.** P
**Riscos.** Nenhum. Conferir a 375 px, onde o grid é de 1 coluna e a régua é outra.

### 9.4 Álbum paginado (D31, D32, D33, D34)

O álbum de hoje (`AlbumGrid.tsx`) é uma pilha de grades: Conquistas, depois cada `CollectionShelf`,
depois "Próximos", depois uma grade por ano — tudo empilhado numa rolagem só. Funciona como
inventário e não parece um álbum. A referência (álbum de figurinhas físico, imagem enviada em
2026-08-06) é o oposto: **uma página por vez**, com o espaço vazio tão presente quanto o preenchido.

#### 9.4.1 O modelo de páginas (D32)

Uma página é uma destas três coisas, e a ordem é essa:

| Tipo | Origem | Conteúdo |
|---|---|---|
| **Coleção** | uma `Collection` do organizador | seus `Slot`s, preenchidos e vazios |
| **Ano** | ingressos passados **sem** `Slot` | agrupados por `getFullYear()` |
| **Figurinhas soltas** | ingressos de eventos futuros | grade de hoje, sem slot vazio |

O corte já existe no dado: `Slot.eventId` é `@unique`, então "está em alguma Collection" é uma
pergunta que o schema responde sem ambiguidade. O que falta hoje é o **complemento**: `AlbumGrid`
monta as páginas de ano a partir de *todos* os ingressos passados (`AlbumGrid.tsx:33`), sem
descontar os que já aparecem numa `CollectionShelf` logo acima — ou seja, hoje o mesmo ingresso é
renderizado duas vezes. Com página única na tela isso deixa de ser redundância discreta e vira
erro visível, então precisa ser corrigido junto: `past.filter((t) => !slottedEventIds.has(t.eventId))`.

**Figurinhas soltas ficam por último e mantêm o layout atual.** Um ingresso de evento que ainda não
aconteceu não é colecionável — não tem "esteve lá", não tem slot que ele preencha, e tem QR. Tratá-lo
como figurinha de álbum é mentir sobre o que ele é. A página de soltas é literalmente a grade de
`ShelfItem` de hoje, com um título que assume o que ela é: "Ainda por vir".

**Conquistas** saem da rolagem e viram a **capa** do álbum (página 0) — é a página que resume quem
a pessoa é como frequentador, e é a primeira coisa que se vê ao abrir um álbum físico.

#### 9.4.2 Layout da página (D33)

Cada página é uma **folha** com proporção fixa (~3:4 no desktop), fundo `bg-surface`, borda
`border-border`, e um cabeçalho com o título da coleção/ano e o contador `n de N` que o
`CollectionShelf` já calcula. Dentro, grade de slots de tamanho estável — **a grade não muda de
densidade conforme o conteúdo**, senão a folha muda de altura a cada virada e a metáfora quebra.

O **slot vazio** é o item que precisa de mais desenho, porque é ele que gera o desejo:

- Fundo com o gradiente de marca correspondente ao índice do slot (`--grad-energia` /
  `--grad-profundidade` / `--grad-legado`), rebaixado (`opacity ~.35`) para ler como "reservado" e
  não como preenchido — a mesma rampa que `EventCard` e `ShelfItem` já usam, então o álbum vazio
  continua parecendo Tessera e não um wireframe.
- Quadrifólio esmaecido no centro, como já existe (`CollectionShelf.tsx:54`).
- **Placeholder nomeado**: `label` da edição, data e cidade — o slot diz *que ingresso seria aquele*.
  Isso já está no payload de `/api/me/collections` (`label`, `eventDate`, `city`), só não está sendo
  usado com peso visual nenhum hoje.
- Borda tracejada `border-border-strong` — mantida, é o sinal universal de "cabe algo aqui".
- "Ver na Revenda" vira **botão**, não link sublinhado de 12 px. É a única ação da página vazia e o
  motor de demanda inteiro do §6.2; hoje ele é a coisa menos visível do card. Continua condicionado
  a `listingId` existir, e o destino passa a carregar o evento (§9.2): `/revenda?tab=collectibles&event=<id>`.
- Slot vazio **sem** anúncio ativo: linha discreta "ninguém está revendendo esta edição" em vez de
  nada. Espaço vazio sem explicação parece bug de carregamento.

#### 9.4.3 Navegação e virada (D34)

Setas ‹ › nas laterais, indicador "3 / 7" embaixo, `←`/`→` do teclado, e swipe horizontal no
mobile. A página corrente vive na URL (`?page=<slug>`) — assim "Ver na Revenda" e voltar não
devolve o usuário para a capa.

**A virada** (D34): a folha que sai gira em `rotateY` no eixo da lombada
(`transform-origin: left center` indo para frente, `right center` voltando), com
`perspective: 1600px` no container e `transform-style: preserve-3d`, ~450 ms em
`cubic-bezier(.2,.7,.3,1)`. Uma sombra que varre a folha durante o giro é o que vende o efeito —
sem ela o resultado parece um card girando, não papel dobrando.

Regras não negociáveis:

- `prefers-reduced-motion: reduce` → troca instantânea, sem transform. Animação de rotação 3D em
  tela cheia é gatilho vestibular clássico.
- A animação nunca bloqueia a navegação: virar duas páginas rápido cancela a anterior e vai para a
  última pedida, não enfileira 450 ms cada.
- Só `transform` e `opacity` — nada que force layout durante o giro.

#### 9.4.4 Lista reduzida a "Próximos" (D31)

`my-tickets/page.tsx` mantém as duas views, mas a lista passa a filtrar
`eventDate >= now`, com o título "Próximos ingressos" e uma linha de rodapé — "Seus ingressos de
eventos que já aconteceram estão no álbum" com link para trocar de view. Sem essa linha, quem tinha
o histórico em lista vai achar que perdeu ingresso.

A lista **não** morre porque ela é o único lugar onde "Anunciar" (D12/§3.7) existe hoje
(`my-tickets/page.tsx:257`), e porque QR + status + ação em linha é a forma certa para o ingresso
que vai ser usado. O álbum é para o que já foi.

Consequência: um ingresso passado só é anunciável pelo álbum. Então `ShelfItem` precisa de ação —
o `onClick` de hoje abre QR e só faz isso para `VALID` (`my-tickets/page.tsx:278`), o que significa
que clicar numa figurinha de evento passado não faz **nada**. Passa a abrir um modal de detalhe da
figurinha (arte grande, evento, data, número, "esteve lá") com "Anunciar" quando `isListable`.

**Arquivos.** `components/ui/AlbumGrid.tsx` (vira `AlbumBook.tsx`),
`components/ui/CollectionShelf.tsx` (vira a página de coleção), `components/ui/ShelfItem.tsx`,
`components/ui/AlbumPage.tsx` (novo), `components/ui/SlotPlaceholder.tsx` (novo),
`app/my-tickets/page.tsx`, `app/api/me/collections/route.ts` (expor `eventId` no slot preenchido,
para o corte de duplicata)
**Tamanho.** M (páginas + slot vazio) · P adicional (virada) · P (lista)
**Riscos.**
- Altura fixa da folha versus coleção com muitos slots: acima de ~12 slots a coleção precisa
  paginar em duas folhas em vez de encolher a grade. Definir o teto antes de construir, não depois.
- O usuário com um ingresso e nenhuma coleção vê um álbum de duas páginas (capa + soltas). Conferir
  que isso não parece quebrado — provavelmente o indicador de páginas some com `total <= 1`.
- `CollectionShelf` é usado só pelo `AlbumGrid`, então a refatoração não vaza para outra tela.

---

## 10. Onda 6 — organizador e conformidade legal

> Aberta em **2026-08-07**. Duas naturezas misturadas: §10.1 e §10.5 são produto; §10.2 a §10.4
> são conformidade, e mudam o que o sistema **deixa** o organizador fazer.
>
> ⚠️ **Nada aqui é parecer jurídico.** As leis citadas foram conferidas em 2026-08-07 e estão
> referenciadas por artigo justamente para o advogado poder auditar. Validar antes do go-live.

### 10.1 Data de início e fim (D35)

**O buraco.** `Event.eventDate` é um instante só. "O evento acabou?" é respondido em pelo menos
quatro lugares (`/api/market` corta as abas por `eventDate < now()`, a home filtra
`eventDate >= now()`, `isListable` em Minha Coleção, o `AlbumBook` separa passado de futuro) — todos
assumindo que o evento termina no segundo em que começa. Um festival de 3 dias vira "colecionável"
na primeira noite, e o ingresso do dia 2 sai da aba Ingressos enquanto ainda vale.

**Como faço.** `endDate DateTime` no schema (obrigatório, com backfill `= eventDate` para os
existentes), campo "Data e hora de término" no Step 1 do `NewEventModal`, e validação
`endDate > eventDate` no `POST/PATCH /api/organizer/events`.

Depois, trocar o predicado nos quatro consumidores: **"já aconteceu" passa a ser `endDate < now()`**,
não `eventDate < now()`. É a mudança de maior alcance da fatia e a que mais merece teste — o corte
passado/futuro é o que decide se um ingresso é ingresso ou colecionável, e portanto em que aba da
Revenda ele pode ser anunciado e sob qual regra (meia não entra na revenda, colecionável não tem
teto).

`doorsOpenAt` continua existindo e passa a fazer par com o fim: portões → início → fim.

**Arquivos.** `prisma/schema.prisma` + migration, `api/organizer/events/route.ts`,
`api/organizer/events/[id]/route.ts`, `components/NewEventModal.tsx`, `api/market/route.ts`,
`app/page.tsx`, `my-tickets/page.tsx`, `components/ui/AlbumBook.tsx`, `lib/availability.ts` (não
muda, mas conferir)
**Tamanho.** M
**Riscos.** O backfill `endDate = eventDate` mantém o comportamento atual para eventos já criados —
nenhum ingresso muda de aba na migração. Conferir que o seed também preenche, senão a fixture
quebra.

### 10.2 Teto de revenda (D36, D37)

#### O que a lei diz, e o que ela não diz

A premissa de que "a lei não permite revenda acima do valor original" **é verdadeira só para
esporte**:

| Norma | Alcance | Efeito |
|---|---|---|
| **Lei 14.597/2023 (Lei Geral do Esporte), art. 166** | **Só evento esportivo** | Vender ingresso por preço superior ao estampado é **crime** — reclusão de 1 a 2 anos e multa. Substituiu o art. 41-F do Estatuto do Torcedor, hoje revogado. |
| **CDC** | Qualquer evento | Sobrepreço pode ser atacado como prática abusiva — risco civil/administrativo, não penal. |
| **Lei 1.521/51, art. 4º** | Qualquer evento | Ganho ilícito por especulação contra economia popular. Detenção de 6 meses a 2 anos. Depende de configurar especulação, não de simplesmente revender acima da face. |

Para show, teatro, festival e conferência **não existe tipo penal federal** de revenda acima da
face — é lacuna legislativa reconhecida, não permissão expressa.

**Decisão.** `ESPORTE` trava em **10000 bps, sem opção de afrouxar** (é conformidade, não
preferência). Demais categorias: 100% vira o **default** e o organizador pode subir, com aviso
explícito na UI de que sobrepreço expõe a exposição do CDC. Hoje o sistema faz o oposto —
`api/organizer/events/route.ts:156` exige `bps >= 10000`, ou seja, **impede** teto abaixo de 100% e
não impõe nenhum limite superior; o seed tem eventos a 150% e 200%.

Inverter a validação: `10000` passa a ser o **máximo** default (mínimo continua existindo para não
forçar revenda com prejuízo, mas some o piso de 100% — um organizador pode querer teto de 80%).

#### Cobrir as taxas do vendedor (D37) — a resposta

A pergunta era: dá para deixar um pouco acima de 100% para o vendedor, depois das taxas, receber os
100%? **Não por esse caminho, e o motivo é que a conta é do lado errado.**

O que a norma olha é **o preço que o comprador paga**. Se o anúncio sobe para 118% para que o
vendedor líquido feche em 100%, quem pagou 118% da face foi o comprador — que é exatamente a
conduta vedada em esporte, e exatamente o sobrepreço que o CDC ataca nos demais. Fazer *gross-up*
converte um problema do vendedor num problema do comprador.

O caminho lícito é **mexer nas deduções, não no preço**:

- **A plataforma zera a própria taxa** (`platformFeeBps`) quando o anúncio está no teto legal.
  É receita nossa, abrimos mão dela por decisão comercial — não há norma nenhuma envolvida.
- **O organizador pode zerar o royalty** (`royaltyBps`) da revenda no teto, se quiser. É escolha
  dele, exposta como opção na criação do evento.

Com as duas, o vendedor a 100% recebe 100%. Sem nenhuma, ele recebe ~82% — e isso precisa estar
**escrito na tela do anúncio**, não descoberto no extrato.

> **Zona cinzenta que fica registrada e não vamos usar sem advogado:** cobrar do comprador uma
> *taxa de serviço destacada* por cima da face, espelhando a taxa de conveniência que o mercado
> primário já cobra. O argumento a favor é a simetria com o primário; o argumento contra é que o
> art. 166 fala em "vender por preço superior ao estampado", e um juiz pode ler o total pago, não
> a decomposição. Em esporte o downside é criminal — não vale o risco. Nas demais categorias é
> defensável, mas só com parecer. Ver **A11**.

**Arquivos.** `api/organizer/events/route.ts`, `api/organizer/events/[id]/route.ts`,
`components/NewEventModal.tsx`, `api/listings/route.ts`, `api/negotiations/route.ts`,
`api/negotiations/[id]/counter/route.ts`, `lib/split.ts`, `prisma/seed.ts` (os 150%/200% viram
dados ilegais para esporte)
**Tamanho.** M
**Riscos.** Eventos já criados com teto acima de 100% em categoria esportiva precisam de decisão de
migração: rebaixar para 10000 é o correto, mas invalida anúncios ativos acima disso. Como não há
deploy em produção, o custo hoje é zero — mais uma decisão barata agora e cara depois.

### 10.3 Meia-entrada obrigatória por categoria (D38)

**Correção do D24.** O documento afirmava que "os 40% são teto da obrigação legal, não piso" e que
"o texto da UI não afirma que a lei exige mínimo". Isso está **errado para evento coberto**: a Lei
12.933/2013 *assegura* o benefício em 40% dos ingressos disponíveis de espetáculos
artístico-culturais e esportivos. Para esses, 40% é **cota mínima obrigatória**. O que é teto é a
*obrigação* — ninguém precisa oferecer 60% — mas o piso existe e é legal, não operacional.

**Mapeamento de categoria.** A lei fala em "salas de cinema, cineclubes, teatros, espetáculos
musicais e circenses e eventos educativos, esportivos, de lazer e de entretenimento":

| Categoria | Meia obrigatória? |
|---|---|
| `SHOW`, `FESTIVAL`, `TEATRO`, `ESPORTE` | **Sim** — núcleo do artístico-cultural e esportivo |
| `CONFERENCIA` | **Provável** — "eventos educativos" está no texto. Ver **A12** |
| `OUTRO` | Indefinido — default ligado, editável. Ver **A12** |

`lib/socialHalfQuota.ts` ganha `isSocialHalfMandatory(category)` ao lado do
`getSocialHalfQuotaBps` que já existe. A cota continua vindo da hierarquia UF → país → default;
o que a categoria decide é se ela é **obrigatória** e qual o **piso**.

O servidor precisa impor isso, não só a UI: `POST /api/organizer/events` força
`hasSocialHalf = true` e `socialHalfBps >= 4000` quando a categoria é coberta, ignorando o que
vier do cliente. UI desabilitada não é validação.

### 10.4 Slider e checkbox (D39)

Hoje é um checkbox só, e a cota é sempre a legal — o organizador não consegue oferecer mais.

- **Com `maxTickets`:** slider de 0–100% da capacidade, passo de 5%. Mostra ao lado a conta
  absoluta ("40% = 200 de 500 ingressos"), porque é isso que o organizador precisa conferir.
  Categoria coberta ⇒ `min = 40`, e o trecho abaixo de 40% aparece bloqueado com o motivo.
- **Sem `maxTickets`:** checkbox. Sem total não existe percentual — 40% de infinito não é um
  número, e fingir que é seria pior que não oferecer o controle. Categoria coberta ⇒ marcado e
  desabilitado, com a nota de que a cota se aplica sobre o total efetivamente vendido.

Isso exige campo novo: **`Event.socialHalfBps`** (null = usa a cota legal da UF). Hoje o percentual
não é armazenado — `socialHalfCap()` recalcula sempre a partir de `getSocialHalfQuotaBps`, o que
funciona enquanto o organizador não pode escolher. A partir do momento em que ele pode oferecer
50%, o número precisa ser persistido. `socialHalfCap()` passa a ler
`event.socialHalfBps ?? getSocialHalfQuotaBps(...)`.

**Arquivos.** `prisma/schema.prisma` + migration, `lib/socialHalfQuota.ts`,
`components/NewEventModal.tsx`, `api/organizer/events/route.ts`,
`api/events/[id]/checkout/route.ts` (o teto de meia já é checado ali, muda só a fonte do bps)
**Tamanho.** M

### 10.5 Reserva e código de entrada (D40, D41)

**Não são alternativas.** São dois presentes de níveis diferentes, decididos em momentos diferentes
do ciclo de vida do evento — e é essa diferença que organiza a fatia inteira:

| | **Reserva de ingresso** | **Código de entrada** |
|---|---|---|
| O que dá | Entrada **+ colecionável** | Só entrada |
| Quando é decidido | Na **criação** do evento | **Depois**, a qualquer momento |
| Onde | Step do `NewEventModal` | Tabela de eventos do organizador |
| Convidado precisa de conta | Sim (carteira provisionada) | **Não** |
| Registro | `Ticket` on-chain + `Checkin` | Só `AccessEntry` no Postgres (não é `Checkin` — ver D43) |
| Para quem | Quem você quer trazer pro produto | Imprensa, staff, entrada pontual |

Reservar é o presente cheio: a pessoa entra, faz check-in e **fica com a figurinha**. O código é o
gesto pequeno — o Zé libera a entrada da afilhada sem transformá-la em usuária da plataforma.
Um não substitui o outro, e o organizador não precisa escolher entre eles: pode usar os dois no
mesmo evento.

#### Reserva (D40)

Continua como o D19 desenhou — cota definida na criação (`Event.reservedTickets`), beneficiário
nomeado depois, mint no fluxo normal, colecionável no fim. O que muda é destravar a intenção
original que a implementação tinha bloqueado sem querer.

**Por que exigia `maxTickets`, e por que isso estava errado.** Não foi decisão de produto; caiu da
implementação. `reservedTickets` é subtraído da disponibilidade pública em `lib/availability.ts`,
então sem `maxTickets` não existe pool do qual subtrair — o campo não significa nada e a UI o
desabilita (`NewEventModal.tsx:296`). A exigência é tautológica *dentro desse modelo*.

Mas o ato de reservar tem duas partes, e só uma delas depende de cota:

| | Precisa de `maxTickets`? |
|---|---|
| **Segurar N vagas** ("não vendo 20 desses 500") | **Sim**, por definição |
| **Nomear alguém e bancar o mint** ("esse é da Maria, eu pago") | **Não** |

Em evento com teto, as duas operam juntas (nomear consome da cota). Em evento **sem** teto, a
primeira não existe — não há escassez para administrar — mas a segunda continua fazendo todo
sentido, e é ela que o organizador queria. Então: `POST /api/organizer/events/[id]/reserved`
(nomear beneficiário) passa a funcionar em qualquer evento; só a **cota** segue condicionada a
`maxTickets`. O campo do Step 3 deixa de ficar desabilitado — vira "quantas vagas segurar", com
nota de que em evento sem teto não é necessário segurar nada para presentear.

`Ticket.facePrice = 0` e o organizador paga só o custo de plataforma (**A13** define quanto).

#### Código de entrada (D41)

O D20 adiou com o argumento de §5.4: *"o convidado ganha o colecionável — que é a razão de existir
do produto, e o que se perderia com um código de acesso sem NFT"*. **O argumento está correto e
continua valendo — só que para a reserva, não para o código.** Ele defende o presente cheio; o
código nunca pretendeu ser presente cheio. Perder o colecionável não é efeito colateral do código,
é a definição dele.

**Fluxo.** Na tabela de eventos do organizador (`/organizer`), cada linha ganha **"Gerar códigos"**.
O organizador informa quantos quer; o servidor emite N códigos de uso único, listados na tela para
copiar/enviar. Nada disso passa pela criação do evento — é operação de véspera, não de cadastro.

O mesmo painel **lista os códigos já emitidos** com o estado de cada um (pendente / usado, e por
qual check-in) e um **"Revogar"** por linha, habilitado só enquanto `usedAt` for null — código já
queimado é registro de quem entrou, não pode sumir. `DELETE /api/organizer/events/[id]/access-codes/[codeId]`
preenche `revokedAt`; a vaga volta na mesma transação. Sem essa tela o `revokedAt` seria um campo
que ninguém consegue preencher, e gerar 50 códigos por engano custaria 50 lugares para sempre.

**O teto é a vaga disponível.** N é limitado por `publicAvailability` no momento da emissão: cada
código pendente ocupa uma vaga igual a um ingresso vendido. Em evento sem `maxTickets` não há
limite a impor. Isso obriga `lib/availability.ts` a passar a descontar códigos pendentes — e é por
isso que **§10.6 é pré-requisito**, não consequência.

**Três guardas que não são opcionais:**

1. **Consome lotação.** Código que não conta é overbooking de casa cheia — problema de alvará e de
   segurança, não de UX. Emitido reserva a vaga; cancelado devolve.
2. **Uso único.** Queimado no primeiro check-in (`usedAt`, `checkinId`). Código reutilizável
   circula em print de WhatsApp e vira entrada paralela — exatamente o que o resto do produto
   existe para evitar.
3. **Rastreável.** `AccessCode { id, eventId, code, label, createdBy, createdAt, usedAt, entryId, revokedAt }`.
   O organizador precisa auditar quem entrou por código, inclusive contra abuso de dentro da
   própria organização.

#### O que o código é, literalmente (D43)

**Não é hash.** Hash é derivação de um dado que já existe — aqui não há o que derivar. O código é
um **segredo aleatório ao portador**, gerado no ato da emissão.

Também **não** é payload assinado como o QR do ingresso. Vale explicar por quê, porque a simetria
é tentadora: `validateQrPayload` (`api/checkin/route.ts:12`) valida por HMAC e não toca no banco —
a assinatura *é* a prova. Isso funciona lá porque o QR é efêmero (janela de 30 s) e não precisa ser
revogado. O código de entrada precisa ser **uso único, revogável e contabilizado em vaga** — os
três exigem uma linha no banco de qualquer jeito. Com a consulta obrigatória, a auto-verificação do
HMAC não compra nada, e o payload assinado ainda seria longo demais para alguém ditar na portaria.

| | Valor |
|---|---|
| Alfabeto | **Crockford Base32** — sem `I`, `L`, `O`, `U`; feito para transcrição humana e leitura em voz alta |
| Tamanho | **10 caracteres** ≈ 10¹⁵ combinações. Com mil códigos num evento, chance de acerto por tentativa ≈ 10⁻¹² |
| Exibição | Agrupado (`4K7P-9XQ2-M3`), copiável e também renderizado como QR |
| Unicidade | **Global** (`@unique` em `code`), não por evento — o `POST /api/checkin` de hoje não recebe `eventId`, deriva do ingresso. Código globalmente único evita ter que pôr seletor de evento na tela do operador |
| Geração | `crypto.randomBytes` → Base32. Nunca `Math.random` |

Na portaria funciona dos dois jeitos: o convidado mostra o QR e o operador escaneia, ou o operador
digita os 10 caracteres. Os dois resolvem para a mesma string.

**Rate limit no check-in é obrigatório**, não opcional. Sem ele a entropia acima protege menos do
que parece: força bruta contra um endpoint aberto é o único ataque que o desenho não elimina
sozinho.

> **Plaintext ou hasheado no banco?** Credencial ao portador se guarda hasheada, por princípio.
> Mas o painel precisa **re-listar** os códigos (§10.5) — o organizador vai perguntar "qual foi o
> que mandei pra Maria?", e com hash a resposta é "não dá para saber, gere outro". Como o dano de
> um vazamento é limitado (entrada única em um evento, revogável em massa, consome vaga que já
> estava contabilizada) e a necessidade de re-listar é diária, **fica em plaintext** com o `label`
> identificando o destinatário. Registrado como escolha consciente, não como descuido.

#### `Checkin` não comporta entrada por código — e isso é bloqueador

`Checkin.tokenId` é `Int @unique` com FK obrigatória para `Ticket` (`schema.prisma:401`). Entrada
por código **não tem ingresso**, então não cabe nesse modelo — a afirmação "gera só um `Checkin` no
Postgres", escrita na tabela comparativa acima, estava errada.

Duas saídas:

| | Custo |
|---|---|
| Tornar `Checkin.tokenId` nulável + `accessCodeId` | `computeAchievements` percorre `checkin.ticket.event.city` (`lib/achievements.ts:30`) e quebra com `ticket` nulo. `attendedEvent` em `/api/market` idem. Migração arriscada num modelo que alimenta conquistas e o selo "Você esteve lá" |
| **Tabela própria `AccessEntry`** | Zero ripple. Conquistas seguem intactas — **e corretamente**: quem entrou por código não tem ingresso nem colecionável, logo não deve ganhar conquista de presença |

**Decisão: `AccessEntry { id, accessCodeId, eventId, staffUserId, scannedAt }`.** Além de não
quebrar nada, é semanticamente honesto — entrada por código não é check-in de ingresso, e forçar as
duas no mesmo modelo faria o produto mentir sobre o que é presença de colecionador. A tela de
auditoria do organizador faz a união das duas fontes na exibição, que é onde a união pertence.

A aba "Acesso via código" no check-in e o botão "Gerar códigos" — que o D20 tinha deixado fora de
escopo junto — voltam com esta fatia.

**Arquivos.** `prisma/schema.prisma` (`AccessCode` + migration), `lib/availability.ts`,
`api/organizer/events/[id]/access-codes/route.ts` (novo — `POST` emite, `GET` lista),
`api/organizer/events/[id]/access-codes/[codeId]/route.ts` (novo — `DELETE` revoga),
`api/organizer/events/[id]/reserved/route.ts`, `api/checkin/route.ts`, `app/checkin/page.tsx`,
`app/organizer/page.tsx`, `components/AccessCodesModal.tsx` (novo — gerar, listar, revogar),
`components/AssignReservedModal.tsx`, `components/NewEventModal.tsx`
**Tamanho.** G (duas features + tela de check-in + mudança em `publicAvailability`)
**Riscos.**
- A conta de lotação vira o ponto mais delicado da onda inteira — e já está inconsistente hoje.
  Ver **§10.6**, que é pré-requisito desta fatia.
- O check-in por código não passa pelo QR rotativo, então o anti-compartilhamento é só o uso único.
  Exigir documento na portaria é operação, não software — mas vale escrever isso na tela do
  operador.

### 10.6 A conta de lotação — fonte única (pré-requisito de §10.5)

> Esta subseção existe porque "o código consome uma vaga" parece uma linha de código e não é. Ela
> é **pré-requisito** do código de entrada: fazer §10.5 sem fazer isto antes é construir o
> overbooking em cima de um bug que já existe.

#### O bug que já está lá

Hoje a disponibilidade é calculada em **dois lugares que não concordam entre si**:

| | Onde | Conta |
|---|---|---|
| **Exibição** | `lib/availability.ts` → home, card, mapa, página do evento | `maxTickets − sold − reservaNãoUsada` |
| **Checkout** | `api/events/[id]/checkout/route.ts:100-118` | `maxTickets − reservaNãoUsada` vs. `sold + inFlight` |

A diferença é o **`inFlight`** — compras em `PENDING`/`PAID`/`MINTING`. O checkout desconta; a
exibição não. Num evento de 500 com 490 vendidos e 10 PIX pendentes, o card anuncia **10
disponíveis** e o checkout responde `sold out` para todo mundo. Não é hipótese: são duas fórmulas
diferentes escritas em arquivos diferentes, e nada as obriga a bater.

Somar código de entrada como uma terceira subtração, do jeito que está, garante que ela vai ser
esquecida em pelo menos um dos dois — que é exatamente o cenário de vender a vaga que o código já
segurava.

#### O desenho

**Uma função, um lugar, quatro parcelas.** `lib/availability.ts` deixa de ser aritmética solta e
passa a ser o razão de lotação do evento:

```ts
export interface CapacityUsage {
  sold:          number; // Ticket emitido
  inFlight:      number; // Purchase PENDING | PAID | MINTING
  codesPending:  number; // AccessCode não usado e não revogado
  unusedReserve: number; // reservedTickets − reservedTicketsAssigned
}

// Uma query, um resultado — todo consumidor parte daqui.
export async function loadCapacityUsage(eventId: string): Promise<CapacityUsage>;

// maxTickets null = ilimitado (null = "sem teto", não zero).
export function publicAvailability(event, usage: CapacityUsage): number | null;
```

O ganho não é elegância, é **impossibilitar o esquecimento**: quem quiser saber quantas vagas
existem chama a função; não há mais como montar a conta à mão e errar uma parcela. A assinatura
muda de propósito — `publicAvailability(event, soldCount)` continuar aceitando um número solto é o
que permite hoje passar `sold` sem `inFlight`. Trocar por `CapacityUsage` faz o compilador apontar
todos os chamadores.

Consertar a exibição para descontar `inFlight` **muda o número mostrado na home** — para menos, e
corretamente. Vale registrar que isso não é regressão: é a home passando a dizer a verdade.

#### Emitir código é operação atômica

Ler a disponibilidade e depois gravar N códigos são dois passos; entre eles cabe um checkout. Como
a emissão é rara (organizador, em lote, na véspera), dá para pagar o preço da forma mais segura:

```
$transaction:
  SELECT ... FOR UPDATE no Event          -- serializa contra outra emissão
  usage = loadCapacityUsage(eventId)
  se N > publicAvailability(event, usage) -> 409, nada gravado
  createMany(N códigos)
```

**Não** replicar isso no checkout. Lá o check continua otimista (`sold + inFlight`) porque é
caminho quente, e a rede de segurança é a que já existe e está documentada no próprio arquivo: o
contrato reverte no mint e a compra é estornada. O ponto é que a emissão de código **nunca** pode
ser o lado frouxo — ela grava um direito de entrada que não passa por contrato nenhum, então não
tem rede embaixo.

**Cancelar devolve a vaga.** `revokedAt` preenchido tira o código de `codesPending`. Sem isso, o
organizador que gera 50 códigos por engano perde 50 lugares para sempre.

**Arquivos.** `lib/availability.ts`, `api/events/[id]/checkout/route.ts`, `app/page.tsx`,
`app/events/[id]/page.tsx`, `api/events/nearby/route.ts`, `api/events/[id]/route.ts`,
`api/organizer/events/route.ts`
**Tamanho.** M
**Riscos.** É refatoração de uma função usada em toda a superfície de listagem. A troca de
assinatura é proposital justamente para o TypeScript listar os chamadores — fazer com
parâmetro opcional derrotaria o objetivo e deixaria o bug de `inFlight` vivo onde ninguém olhasse.

---
