# App web (`app/`) — evolução de produto pós-design system

**Documento de execução.** Sucede [`APP_DESIGN_SYSTEM_MIGRATION.md`](./APP_DESIGN_SYSTEM_MIGRATION.md), que já foi executado: o app está no design system (tokens, AppShell, biblioteca de componentes, 7 telas migradas). Aquele documento vira histórico; este descreve a próxima rodada, que é **de produto**, não de estilo.

- **Referência normativa de marca:** [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — continua valendo integralmente
- **Referência visual:** [`platform/preview/`](../platform/preview/) — o carrossel e o layout de coleção já existem lá como gabarito
- **Alvo:** `app/` — Next.js 16.2.9, React 19.2.4, Tailwind 4, Prisma 7, Privy

> ⚠️ `app/AGENTS.md` avisa que esta versão do Next.js tem breaking changes em relação ao que os modelos conhecem. Confirme a API em `node_modules/next/dist/docs/` antes de mexer em roteamento, `metadata`/`viewport` ou Server Components. Pontos já verificados nesta base: `params`/`searchParams` são `Promise`, `themeColor` vive no export `viewport`, `ImageResponse` vem de `next/og`.

---

## 1. O que já existe (ponto de partida)

Componentes prontos em `app/app/components/`: `AppShell`, `Logo` e `ui/` com `Button`, `Badge`, `Panel`, `Modal` (portal, foco preso, `Esc`), `Field`/`SelectField`/`TextareaField`, `StatCard`, `TicketRow`, `EmptyState`, `EventCard`, `PageTitle`, `Icon`. **Reuse isso** — nenhuma frente abaixo justifica componente novo que duplique um destes.

Três fatos do backend/contrato que definem o custo de tudo que vem a seguir, verificados no código:

1. **`TicketResale.settleListedTicket()` só transfere o NFT.** No fluxo fiat, os repasses em BRL são feitos off-chain pelo PSP (o comentário no contrato diz isso explicitamente). Logo, **preço negociado não exige mudança de contrato** — o backend calcula os shares sobre o valor acordado. A revenda no app é 100% fiat: `buyListedTicket()` (cripto direto) nem está exposto no ABI, mas segue chamável direto no contrato por qualquer carteira — o que tem consequência para a negociação (ver §6.4).
2. **`listTicket()` não valida a data do evento.** Quem impede revenda de ingresso de evento passado é a API — `app/app/api/listings/route.ts` exige `ticket.status === "VALID"`. O mercado de colecionáveis é regra de backend, não contrato novo.
3. **Não existe saldo em lugar nenhum.** O model `Withdrawal` existe, mas nada o alimenta e não há ledger. O saldo que aparece em `platform/preview/ingressos.html` é maquete estática.

Faltam ainda no `Event`: categoria, destaque, hora de abertura, line-up.

---

## 2. Decisões desta rodada

| Tema | Decisão |
|---|---|
| Dados de evento | Novos campos no schema **e** seed expandido (~12 eventos variados) |
| Carrossel | Híbrido: ranking automático por vendas recentes + pin do admin |
| Filtros | Localidade e calendário (data única ou intervalo), somados à busca textual |
| Mercado | Duas abas: **Ingressos** (eventos futuros) e **Colecionáveis** (eventos passados) |
| Colecionável | Vale quando o evento terminou; quem fez check-in ganha selo de presença |
| Contra-proposta | Negociação de até **3 rodadas**, 24h por rodada, vários compradores em paralelo, primeiro que fecha leva |
| Aviso de negociação | E-mail transacional + badge de pendências no app |
| Saldo | Ledger completo (crédito por venda, débito por saque) + card destacado fora da lista |
| Álbum | Toggle lista/álbum, agrupamento por ano e evento, conquistas deriváveis dos dados existentes |
| Série/turnê | **Fora desta rodada** — conquistas do tipo "3 de 5 da turnê" ficam para quando existir o model |

---

## 3. Frente 1 — Dados de evento

Base de tudo: sem categoria não há chip, sem volume não há carrossel que faça sentido.

### 3.1 Schema (`app/prisma/schema.prisma`)

```prisma
enum EventCategory {
  SHOW
  FESTIVAL
  TEATRO
  ESPORTE
  CONFERENCIA
  OUTRO
}

model Event {
  // … campos atuais
  category      EventCategory @default(OUTRO)
  subcategory   String?       // texto livre: "Rock", "Eletrônica", "Stand-up"
  lineup        String?       // artistas / atrações, texto livre
  doorsOpenAt   DateTime?     @map("doors_open_at")
  featuredRank  Int?          @map("featured_rank")  // pin do admin; null = concorre pelo ranking automático
}
```

**Categoria é enum, subcategoria é texto livre.** A enum mantém a lista de chips da home estável e previsível; se fosse string, cada organizador inventaria a sua e a barra de chips viraria lixo. A subcategoria alimenta o eyebrow do card (`Show · Rock`), que hoje mostra o nome da produtora por falta de campo melhor — corrigir isso em `EventCard`.

### 3.2 Seed (`app/prisma/seed.ts`)

Hoje há **um** evento. Expandir para ~12 cobrindo os estados que a UI precisa exercitar: cidades diferentes, datas espalhadas (incluindo **eventos passados**, obrigatórios para a aba de colecionáveis), com e sem `coverImageUrl`, esgotado, pausado, aguardando aprovação, e alguns com ingressos já mintados e check-in feito (para o selo de presença e o álbum terem o que mostrar).

### 3.3 Formulário do organizador

`app/app/organizer/page.tsx` precisa dos campos novos: `SelectField` para categoria, `Field` para subcategoria e line-up, `Field` datetime para abertura dos portões.

---

## 4. Frente 2 — Home: carrossel e filtros

### 4.1 Carrossel de destaques

Gabarito pronto em `platform/preview/index.html`: slides `.hero` com gradiente da marca, `#N` de ranking, símbolo grande esmaecido, tag, título, meta e CTA com preço.

Critério de entrada, na ordem:

1. Eventos com `featuredRank` preenchido, ordenados por ele (pin do admin)
2. O restante das vagas preenchido por vendas recentes — `Purchase` com status `COMPLETED` nos últimos 7 dias, agrupado por evento
3. Empate ou base vazia: próximos eventos por `eventDate`

O passo 3 não é detalhe — com pouco dado, ranking por vendas devolve lista vazia e o carrossel some. Ele garante que a home nunca fica sem destaque.

Componente novo `app/app/components/ui/Carousel.tsx` (Client — scroll-snap, setas, dots, teclado). A home continua **Server Component**: ela calcula os destaques com Prisma e passa os slides prontos como props. Não transformar `page.tsx` em Client.

No `/admin`, um painel para definir/limpar o pin — reusar `Panel` e a tabela de eventos que já existe lá.

### 4.2 Filtros

Três filtros somados à busca textual atual, todos refletidos na URL (`?q=&cat=&city=&from=&to=`), para a página continuar Server Component e o estado ser compartilhável:

- **Categoria** — barra de chips (`.chips` do preview), um chip por valor da enum
- **Localidade** — `SelectField` alimentado pelas cidades distintas de eventos em venda; nada de campo livre, que hoje erra por acento e caixa
- **Calendário** — data única **ou** intervalo

Componente novo `app/app/components/ui/EventFilters.tsx` (Client): lê `useSearchParams()`, escreve via `useRouter().replace()`. A página lê `searchParams` (lembrando: é `Promise` no Next 16) e monta o `where` do Prisma. O date range precisa de um `DateRangePicker` próprio — sem biblioteca externa, dois inputs `date` com validação de ordem resolvem e mantêm o bundle limpo.

Atenção a fuso: `eventDate` é `DateTime` em UTC; o filtro precisa considerar o dia em horário local do usuário, senão eventos da noite caem no dia seguinte.

---

## 5. Frente 3 — Mercado em duas abas

`/market` passa a ter dois territórios, separados por `Tabs` (componente novo, simples, em `ui/`):

| Aba | Conteúdo | Regra de listagem |
|---|---|---|
| **Ingressos** | Eventos que ainda não aconteceram | Só ingresso `VALID`; comportamento atual preservado |
| **Colecionáveis** | Eventos que já aconteceram | Qualquer ingresso do usuário daquele evento, tenha havido check-in ou não |

### 5.1 Regra de corte

Derivar de `event.eventDate < now()`, **não** de `EventStatus.ENDED` — a enum existe mas nada garante que algum job a atualize hoje. Se/quando existir esse job, migrar para o status, que é mais explícito.

### 5.2 Mudanças no backend

`app/app/api/listings/route.ts` hoje rejeita tudo que não seja `VALID`. A regra passa a ser bifurcada, e a ordem importa para não abrir brecha:

- Evento **futuro**: só lista se `VALID` (ingresso já usado não pode voltar a ser vendido como entrada — seria vender uma entrada que não entra)
- Evento **passado**: lista independentemente do status, como colecionável

`app/app/api/market/route.ts` ganha o parâmetro de aba e devolve os dois conjuntos separados.

### 5.3 Selo de presença

Derivado — existe `Checkin` para aquele `tokenId` — sem campo novo. Aparece como `Badge` no card do colecionável e na peça do álbum: **"Você esteve lá"**. É o que diferencia um colecionável de uma entrada não usada, e é o dado que dá preço ao item.

### 5.4 Apresentação

O colecionável não é um ingresso: nada de contagem regressiva, disponibilidade ou "expira em". Card próprio (`CollectibleCard`) destacando evento, data em que aconteceu, selo de presença e número do ingresso.

### 5.5 Teto de revenda

A decisão de produto está em [`BRAINSTORM.md`](../BRAINSTORM.md) e o conceito em [`Glossary.md`](../Glossary.md): **teto configurável por evento pelo organizador — se definido, nenhuma revenda pode superar X% do preço original; se não configurado, sem limite.** Nada disso existe no código hoje: `Event` não tem o campo, `app/app/api/listings/route.ts` não valida preço, e `TicketResale.listTicket()` exige apenas `price > 0`.

**Schema**

```prisma
model Event {
  // … campos atuais
  maxResaleBps Int? @map("max_resale_bps")  // 20000 = 200% do preço original; null = sem teto
}
```

Em basis points pelo mesmo motivo de `platformFeeBps` e `royaltyBps`: evita ponto flutuante em dinheiro e mantém a convenção da base.

**Base de cálculo: o preço original do ingresso, não o do evento.** Usar `Ticket.facePrice` (o que aquele ingresso custou na venda primária), não `Event.ticketPriceUsdc` — se houver lotes ou o organizador alterar o preço do evento, o teto de quem comprou no lote 1 não pode mudar retroativamente. Teto = `facePrice × maxResaleBps / 10000`.

**Onde valida**

- `POST /api/listings` — recusa a listagem acima do teto, com mensagem dizendo qual é o teto
- Aceite de negociação — uma contraproposta **do vendedor** pode subir o preço; validar o `agreedPrice` contra o teto no aceite, não só na abertura da negociação
- UI do formulário de revenda — mostra o teto antes de o usuário digitar e valida no cliente, mas a API é a autoridade

**Regras**

- Vale só para ingresso de **evento futuro**. Colecionável (evento passado) **nunca** tem teto: o evento acabou, o organizador não tem mais interesse legítimo em limitar, e o valor de um colecionável é o que o mercado atribui
- O organizador define no cadastro do evento (`SelectField` com opções usuais — 100%, 150%, 200%, sem limite — mais campo livre) e pode **afrouxar** depois, nunca apertar: apertar quebraria anúncios já publicados de boa-fé
- Teto ausente (`null`) é mercado livre, não erro

**Limitação conhecida, decidir antes de prometer publicamente:** validar só na API cobre 100% de quem usa o app, mas o `TicketResale` é público — quem chamar `listTicket` direto pela carteira ignora o teto. Para o teto ser garantia de verdade, ele precisa ser imposto no contrato: o `TicketNFT` já guarda `facePrice` nos metadados do token, então o `TicketResale` conseguiria ler e recusar, mas o teto do evento também teria que viver on-chain — mudança de contrato. **Recomendação:** implementar na API agora e tratar o teto como política de plataforma; se antiflipagem virar promessa de marketing, aí sim levar para o contrato, porque promessa que se fura com uma chamada direta vira problema de reputação.

### 5.6 Split da revenda — o dinheiro não chega em ninguém hoje

**Achado ao verificar o código, e é bloqueante para tudo que envolve dinheiro neste documento.** Hoje não existe split: nem correto, nem incorreto — não existe.

- A interface `PspProvider` (`app/lib/psp/index.ts`) tem três métodos: `createPixCharge`, `refund`, `verifyWebhook`. **Nenhum deles paga ninguém.**
- `createPixCharge(amountBrl, externalRef)` cria cobrança do valor cheio, recebedor único
- O fluxo de revenda em `app/app/api/webhooks/psp/route.ts` faz `settleListedTicket` e atualiza o banco. Não repassa ao vendedor, não paga royalty ao organizador, não segrega taxa
- O comentário em `TicketResale.settleListedTicket()` — *"PSP split already settled payment off-chain (seller/organizer/platform each received their BRL share directly)"* — descreve uma intenção que o código não cumpre

Na prática o PIX cai inteiro na conta da plataforma e fica lá. É também por isso que o `Withdrawal` nunca teve lastro (§7).

**A propriedade sempre anda on-chain, nos dois fluxos do §5.7.** Escrow no `listTicket`, entrega no `settleListedTicket`. É o escrow — não o pagamento — que impede revenda duplicada: o NFT sai da carteira do vendedor no momento da listagem, então ele não consegue vender em outro lugar. O que varia entre os fluxos é apenas por onde o **dinheiro** anda.

**Camadas de garantia, em qualquer fluxo:**

1. **O número vem do contrato.** Royalty calculado por `royaltyInfo(tokenId, preçoAcordado)` (ERC-2981), nunca por aritmética de backend.
2. **Atestado on-chain do split** (§5.7.2) — os valores ficam gravados na transação que já acontece, então nem a plataforma consegue alterá-los depois.
3. **Ledger + conciliação.** O ledger da §7 registra o devido; um job compara com os repasses efetivos e alerta divergência. Detecta, não previne — é a rede de segurança das outras duas.

**Identificação: ver a escada do §5.6.1.** O ponto que importa aqui é que verificação completa só é exigida de quem **recebe** dinheiro — nunca como barreira de entrada.

### 5.6.1 Escada de identificação

"KYC" vinha cobrindo três coisas de custo e atrito muito diferentes. Separando:

| Nível | O que é | Custo |
|---|---|---|
| **Identificação** | Pedir o CPF | Baixo, quase sem atrito |
| **KYC completo** | Documento, selfie, validação em base, checagem de listas | Atrito real + **custo por consulta** |
| **KYB** | Equivalente para empresa: CNPJ, contrato social, sócios | Alto, mas pontual |

Quando cada um é exigido:

| Momento | Nível | Por quê |
|---|---|---|
| Primeira compra | **Identificação (CPF)** | Já necessário para `max_per_cpf` e meia-entrada (ver `BRAINSTORM.md`). E quem paga PIX já se identifica pelo próprio trilho — a conta bancária tem CPF |
| Primeiro evento do organizador | **KYB** | Recebe dinheiro da venda primária, e evento falso é dano grande |
| **Primeiro anúncio de revenda** | **KYC completo** | É onde existe a obrigação de saber para quem se paga — e cobrar no anúncio, não no recebimento, evita o vendedor descobrir só depois da venda que o dinheiro está retido |

**Deliberadamente não fazemos KYC completo em comprador.** Ele não recebe dinheiro, então não há obrigação que justifique — e seria pagar consulta por cada visitante que compra um ingresso, com atrito no momento de maior desistência. CPF resolve o que é preciso ali.

> Toda esta escada pressupõe que a obrigação de verificar nasça no pagamento **ao** usuário, não na compra. É a pergunta 4 do §5.7 — se o jurídico responder diferente, esta tabela muda.

**Encaixe com a negociação:** o preço acordado é decidido antes de a cobrança existir, então negociação e split combinam sem atrito — desde que o `agreedPrice` seja a base do split, não o preço do anúncio.

> A mesma lacuna existe na **venda primária** (organizador e plataforma também não recebem repasse hoje). Está fora do escopo deste documento, mas é o mesmo trabalho e provavelmente deve ser feito junto.

### 5.7 Caminho do dinheiro — dois fluxos, por preferência de recebimento

**Decisão:** o destinatário escolhe como quer receber. Em ambos os fluxos a propriedade do ingresso anda on-chain (§5.6); o que muda é só o trilho do dinheiro.

| | **Fluxo Reais** (padrão) | **Fluxo Cripto** (opt-in) |
|---|---|---|
| Caminho | PIX entra, split feito internamente, PIX sai | PIX entra, plataforma converte para USDC, contrato faz o split, USDC vai para a carteira informada |
| Split | Executado pela plataforma | **Executado pelo contrato**, atômico |
| Verificação | Atestado on-chain (§5.7.2) | O próprio pagamento é a prova |
| Custo | Sem spread de câmbio, sem gas de liquidação | Uma conversão + gas |
| Quem usa | A maioria — quem quer dinheiro na conta | Quem quer garantia total ou já opera em cripto |

**O que isso elimina.** Some o híbrido inteiro que estava desenhado aqui: o `approve` de USDC para recompra, o off-ramp automático, o estado de fallback e o **BRL → USDC → BRL**. Aquilo existia para dar garantia cripto a quem quer reais; com dois fluxos, quem quer reais simplesmente não passa pela perna cripto. Some spread duplo, some gas por venda e some a máquina de recompra.

Melhora também o enquadramento: no fluxo Reais **nenhum usuário toca em cripto**, e no fluxo Cripto ele pediu explicitamente e informou a carteira — consentimento inequívoco em vez de posse involuntária de segundos.

### 5.7.1 Estrutura que os dois fluxos exigem

`Organizer` já tem `payoutWallet`. Falta a preferência, e falta o equivalente no `User`:

```prisma
enum PayoutMethod { PIX CRYPTO }

model User {
  // … campos atuais
  payoutMethod PayoutMethod @default(PIX) @map("payout_method")
  pixKey       String?      @map("pix_key")
}
```

Não há `payoutWallet` para vendedor — ver a decisão no §5.7.3. No fluxo Cripto o destino é o próprio `walletAddress`, a carteira que anunciou.

Três cuidados:

1. **Chave PIX validada contra o CPF do KYC.** É o controle que o trilho fiat oferece de graça e que o cripto não tem: a chave precisa pertencer a quem se identificou. Chave de terceiro é recusada.
2. **Trocar `pixKey` é ação de alto risco.** Conta invadida vira desvio de dinheiro. Exige reautenticação, aviso por e-mail e carência antes de valer para novos recebimentos.
3. **Escolher Cripto não dispensa o KYC.** Mandar valor para carteira não é menos sensível que PIX — possivelmente mais, já que endereço não carrega identidade. A escada do §5.6.1 vale igual nos dois fluxos.

### 5.7.2 Atestado on-chain — a garantia que cobre os dois fluxos

**O problema que isto resolve:** se o split só fosse verificável no fluxo Cripto, a garantia seria opcional — e garantia opcional não é garantia. Uma plataforma mal-intencionada usaria o fluxo Reais. Pior: o organizador, que é quem mais precisa conferir royalty, é justamente quem mais vai querer dinheiro na conta da empresa.

**Atestado on-chain ≠ dinheiro on-chain.** Isto confunde e vale explicitar: o atestado **não** reintroduz o BRL → USDC → BRL, que segue descartado. No fluxo Reais nenhum centavo vira cripto.

O que existe é outra coisa: **toda revenda já manda uma transação on-chain, e ela é sobre o ingresso, não sobre dinheiro.** O NFT está em escrow no contrato desde o `listTicket`, e entregá-lo ao comprador exige o `settleListedTicket` — que já é chamado hoje, em toda venda, independentemente de como o dinheiro andou.

O atestado é acrescentar informação a essa transação que já ia acontecer:

```
hoje:  settleListedTicket(listingId, recipient)
       → transfere o NFT do escrow para o comprador

com atestado:
       settleListedTicket(listingId, recipient, agreedPrice)
       → transfere o NFT do escrow para o comprador
       → e grava: venda R$ 400 · royalty R$ 40 · vendedor R$ 340 · plataforma R$ 20
```

| | Dinheiro | Ingresso | Registro do split |
|---|---|---|---|
| Onde anda | PIX, 100% off-chain | On-chain (escrow → comprador) | On-chain, na mesma tx do ingresso |
| Custo | Taxa do PSP | Gas que já se paga hoje | Alguns centavos de calldata |

O contrato **anota** os números; não recebe, não guarda e não paga nada. É registro de cartório: o dinheiro trocou de mão por fora, e o livro que ninguém rasura guarda quanto foi e para quem.

**Por que a plataforma não consegue falsificar o registro.** O royalty não é informado — o contrato o calcula com `royaltyInfo(tokenId, agreedPrice)`, lendo o ERC-2981 gravado no ingresso no momento do mint. Restaria mentir sobre o **preço**, mas ele foi visto pelo comprador (que pagou) e pelo vendedor (que anunciou ou aceitou): duas partes independentes capazes de contestar.

| | Pagamento on-chain (fluxo Cripto) | Atestado on-chain (todos) |
|---|---|---|
| Garantia | **Impede** pagar errado | **Prova** o que era devido |
| Custo | Conversão + gas por venda | ~zero — transação que já acontece |
| Cobertura | Só quem optou por cripto | **Todas as vendas** |

Para o organizador conferir royalty, prova costuma bastar: existe contrato entre as partes e o registro é imutável. Prevenção total fica com quem opta por cripto — e tudo bem, porque quem opta é quem se importa.

**Extrato do organizador — a interface do atestado.** Ninguém confere royalty lendo evento de blockchain, então o organizador precisa de um extrato legível em `/organizer`: por evento, por venda, com data e valor. Mas atenção ao que ele é: **um extrato gerado pela plataforma é a plataforma declarando quanto ela acha que deve** — se o número estiver errado, o extrato mostra o número errado com a mesma confiança. Por isso ele não substitui o atestado, ele o consome:

- Cada linha carrega o hash da transação de settle e permite conferir aquela venda contra a cadeia
- A própria tela marca **"conferido on-chain ✓"** por linha, comparando o valor do extrato com o que o contrato registrou — o organizador só precisa olhar as divergências
- Sem infraestrutura nova: é uma visão sobre o `LedgerEntry` do §7 (o tipo `ROYALTY_PAYOUT` já existe), filtrada por organizador e agrupada por evento

### 5.7.3 Mudança no `TicketResale` — uma só

Os dois problemas levantados neste documento — **aceitar preço negociado** e **gravar o split** — são a mesma função precisando da mesma informação, que ela hoje não recebe. `settleListedTicket(listingId, recipient)` só transfere o NFT: não conhece preço nem fatias.

```solidity
settleListedTicket(listingId, recipient, agreedPrice)
```

Calcula o royalty via `royaltyInfo(tokenId, agreedPrice)`, registra as fatias (vendedor, royalty, plataforma) e transfere o NFT. Sem negociação, `agreedPrice` é o preço do anúncio. **Uma mudança, uma auditoria** — não duas como sugerido antes.

**Destino do pagamento no fluxo Cripto — resolvido, sem mudança extra.**

O caso do organizador **já está coberto pelo contrato**: `TicketSale` faz deploy de um `RoyaltySplitter` por evento e o registra como `royaltyReceiver` do ERC-2981; `_buyListed` paga o royalty para o endereço vindo de `royaltyInfo()`, nunca para quem listou. Organizador recebe onde foi configurado, incluindo carteira institucional ou fria.

Sobra só o `l.seller` — a carteira que chamou `listTicket`. **Decisão: no fluxo Cripto o pagamento vai para a mesma carteira que anunciou.** Sem `payoutWallet` customizável para vendedor nesta rodada.

Por quê:

- **O vendedor não configura nada.** A carteira embedded já existe (criada pelo Privy no login) e é a mesma que anunciou: nenhum campo para preencher, nenhuma chance de digitar errado
- O caso institucional legítimo já está resolvido pelo splitter; sobra o revendedor cripto-nativo querendo outra carteira, que é público pequeno
- **Endereço de carteira não tem identidade.** Uma chave PIX se valida contra o CPF do KYC; um endereço, não. Aceitar destino livre joga fora um controle que o trilho fiat dá de graça
- Erro de endereço ou de rede é **perda permanente**, sem estorno — e endereço de depósito de exchange, que é o que usuário leigo cola, frequentemente não aceita transferência arbitrária
- Endereço sancionado ou congelável (USDC é bloqueável pela Circle) vira problema de compliance **da plataforma**
- Zero mudança de contrato, auditoria menor

**Adicionar depois é fácil; tirar depois é impossível.** Se lançar com destino livre e descobrir perda e suporte, não dá para recuar sem quebrar quem já configurou.

Consequência para o §5.7.1: `User.payoutWallet` **sai** desta rodada. Fica `payoutMethod` e `pixKey`; no fluxo Cripto o destino é o `walletAddress` que anunciou.

⚠️ **Efeito colateral a vigiar:** o fluxo Cripto vira o de menor atrito — nada para cadastrar, contra chave PIX mais verificação no fluxo Reais. Isso não pode transformá-lo em atalho para pular o KYC. A escada do §5.6.1 vale igual nos dois, e a UI não deve apresentar o Cripto como "o caminho rápido": ele é opção para quem quer, não desvio para quem não quer se identificar.

### 5.7.4 Perguntas para o jurídico

1. No **fluxo Cripto**, enviar USDC para carteira informada pelo usuário torna a plataforma VASP (Lei 14.478/2022)? A transferência é operação de câmbio?
2. O **fluxo Reais** — PIX entra, split interno, PIX sai, sem nenhum usuário tocando em cripto — tem enquadramento diferente e mais leve? *(É a hipótese de trabalho: se estiver errada, o desenho dos dois fluxos perde parte do sentido.)*
3. Em que momento a verificação é exigível: conta, compra, anúncio ou pagamento? **Isto altera a escada do §5.6.1**, que hoje pressupõe KYC completo no primeiro anúncio de revenda.
4. Manter caixa em USDC para liquidar o fluxo Cripto exige alguma licença ou tratamento contábil/cambial específico?
5. Valor retido temporariamente na plataforma — venda liquidada mas pagamento ainda não enviado — configura instituição de pagamento (Lei 12.865/2014 e resoluções do BACEN)?

> As referências normativas vêm de conhecimento geral e desatualizável, em área que muda rápido. Servem para pautar a conversa com quem é da área, não para embasar decisão.

### 5.8 Identidade do vendedor — Verified opcional

Dois problemas distintos, que não se resolvem com a mesma ferramenta:

- **Impersonação** — alguém se passar por famoso para valorizar o anúncio. Problema de confiança.
- **Identificação de quem recebe dinheiro** — dever ligado ao pagamento. Resolvido pela escada do §5.6.1.

Aqui a impersonação pesa **menos** do que num marketplace comum: o ingresso é NFT em escrow com procedência on-chain, então o comprador não precisa confiar no vendedor para saber que o ingresso é legítimo. Ela só vira dinheiro num lugar — **colecionável**, onde "este ingresso era do baterista da banda" é procedência virando preço. É exatamente o mercado do §5.

**Decisão: Verified é opcional e público.**

- Selo de **identidade confirmada**, nunca de endosso da plataforma. A diferença precisa estar no texto do selo e no tooltip: "identidade verificada", não "vendedor confiável"
- Opcional: quem só compra ou revende ingresso comum não precisa
- Exibido no anúncio, no card de colecionável e no perfil do vendedor. `Badge` já resolve visualmente
- Não confundir com o selo "Você esteve lá" (§5.3), que é sobre o ingresso; este é sobre a pessoa

**Nome de exibição controlado — vale mais que o selo e custa menos.** A maior parte da impersonação vem de campo de nome livre. Se o vendedor não consegue digitar "Anitta Oficial" — porque o nome deriva da identidade verificada ou de um handle único que não aceita imitação —, o vetor mais comum morre sem precisar de KYC nenhum. **Implementar isso desde já**, independentemente do Verified.

---

## 6. Frente 4 — Contra-proposta (negociação P2P)

O ponto mais denso do documento. Sistema assíncrono, sem chat: comprador propõe valor, vendedor aceita, recusa ou devolve um contra-valor.

**Escopo: revenda apenas.** Negociação existe entre usuários, sobre um `Listing` do `TicketResale`. A venda primária (organizador → usuário, via `TicketSale`) tem preço definido pelo organizador, não gera listing e **nunca** é negociável. Nenhum botão de proposta pode aparecer em `/events/[id]`.

### 6.1 Schema

```prisma
enum NegotiationParty { BUYER SELLER }

enum NegotiationStatus {
  OPEN        // aguardando resposta de quem tem a vez
  ACCEPTED
  DECLINED
  EXPIRED     // rodada venceu sem resposta
  SUPERSEDED  // ingresso fechou em outra thread
}

model Negotiation {
  id           String            @id @default(cuid())
  listingId    String            @map("listing_id")
  buyerUserId  String            @map("buyer_user_id")
  status       NegotiationStatus @default(OPEN)
  turn         NegotiationParty                       // de quem é a vez
  roundCount   Int               @default(1) @map("round_count")
  expiresAt    DateTime          @map("expires_at")   // vencimento da rodada corrente
  agreedPrice  Decimal?          @map("agreed_price") @db.Decimal(18, 6)
  createdAt    DateTime          @default(now()) @map("created_at")

  listing Listing            @relation(fields: [listingId], references: [id])
  buyer   User               @relation(fields: [buyerUserId], references: [id])
  rounds  NegotiationRound[]

  @@unique([listingId, buyerUserId])   // uma thread por comprador por anúncio
  @@map("negotiations")
}

model NegotiationRound {
  id            String           @id @default(cuid())
  negotiationId String           @map("negotiation_id")
  roundNumber   Int              @map("round_number")
  author        NegotiationParty
  priceUsdc     Decimal          @db.Decimal(18, 6)
  createdAt     DateTime         @default(now()) @map("created_at")

  negotiation Negotiation @relation(fields: [negotiationId], references: [id])

  @@map("negotiation_rounds")
}
```

### 6.2 Máquina de estados

Três rodadas, 24h cada:

1. **Comprador oferece** → `turn = SELLER`
2. **Vendedor**: aceita (fecha), recusa (`DECLINED`) ou contrapõe → `turn = BUYER`
3. **Comprador**: aceita (fecha) ou recusa

Esgotadas as 3 rodadas sem acordo, a negociação encerra e o comprador pode abrir uma nova. Rodada vencida sem resposta vira `EXPIRED` — via job ou verificação preguiçosa na leitura, o que for mais simples de manter honesto.

### 6.3 Exclusividade — o ponto que dá bug silencioso

Vários compradores negociam o mesmo ingresso em paralelo, cada um na sua thread privada. Quando **uma** fecha, todas as outras daquele `listingId` viram `SUPERSEDED` **na mesma transação de banco** em que a aceita vira `ACCEPTED`. Só depois disso vem o `lockListing` on-chain e o checkout.

A ordem é essa e não outra: travar primeiro e cancelar depois deixa janela para dois aceites concorrentes. E a transação precisa reler o status do listing dentro dela — se já não estiver `ACTIVE`, o aceite falha com mensagem clara em vez de gerar uma venda fantasma.

### 6.4 Preço acordado × contrato — travar no aceite

`agreedPrice` vive **fora da cadeia**. O backend calcula os repasses em BRL sobre ele e chama `settleListedTicket`, que apenas move o NFT em escrow. O contrato continua achando que o anúncio vale `l.price`.

Hoje isso não conflita com o app: o fluxo de revenda é 100% fiat (`lockListing` → PIX → webhook do PSP → `settleListedTicket`), e `buyListedTicket` **nem está exposto no ABI** em `app/lib/contracts/abis.ts` — a UI não tem como chamá-lo. O risco não é o app, é o contrato: `buyListedTicket` é `external payable` e qualquer pessoa pode chamá-lo direto pela carteira, pagando o preço cheio e levando um ingresso já prometido a outro comprador.

**Mitigação, sem tocar no contrato:** ao aceitar a negociação, chamar `lockListingOnChain(onchainListingId, endereçoDoComprador)` imediatamente, na sequência da transação de banco do §6.3. Isso resolve as duas pontas de uma vez:

- `_buyListed()` tem `require(!l.locked, "Listing locked")` → a compra direta on-chain passa a reverter
- `settleListedTicket()` valida `lockedBuyer == recipient` → o ingresso fica reservado para o comprador que fechou, e nem um settler comprometido consegue redirecioná-lo

O lock fica de pé enquanto o comprador paga o PIX. Se não pagar no prazo, `unlockListingOnChain` devolve o anúncio ao mercado — o mesmo par lock/unlock que `app/app/api/listings/[id]/checkout/route.ts` já usa hoje, então não há mecanismo novo a inventar.

### 6.5 API e UI

Rotas novas sob `app/app/api/negotiations/`: `POST /` (abrir), `POST /[id]/counter`, `POST /[id]/accept`, `POST /[id]/decline`, `GET /` (minhas negociações, como comprador e como vendedor).

Na UI: botão **"Fazer proposta"** ao lado de "Comprar" no card do mercado; `Modal` com o valor proposto e o que o vendedor recebe; painel de negociações em `/market` (ou aba própria) com as threads abertas de cada lado, mostrando o histórico de rodadas e de quem é a vez. Reusar `Modal`, `Panel`, `Badge`, `Field`.

### 6.6 Notificação — dependência obrigatória

Negociação assíncrona sem aviso morre por expiração. Escopo mínimo:

- **E-mail transacional** em: oferta recebida, contraproposta recebida, aceite, recusa, expiração próxima. O e-mail do usuário já vem do Privy (`User.email`). Escolher provedor e criar `app/lib/mail.ts` faz parte desta frente.
- **Badge de pendências** no `AppShell`, contando ações que esperam por você. Ele já busca `/api/me`; estender o payload com essa contagem em vez de criar outra chamada.

---

## 7. Frente 5 — Saldo e ledger

Hoje o saque (`Withdrawal`) não tem lastro: não existe saldo. O card de saldo em Minha Coleção não pode ser desenhado antes disso existir de verdade, sob pena de mostrar número inventado.

> **Depende da §5.6.** O ledger registra o que é devido a cada um; sem o split funcionando, ele registraria crédito de dinheiro que nunca saiu da conta da plataforma — saldo que o usuário não consegue sacar. Ledger e split são o mesmo bloco de trabalho, nesta ordem: split primeiro, ledger espelhando o que foi efetivamente repassado nos dois fluxos do §5.7.

### 7.1 Schema

```prisma
enum LedgerEntryType {
  RESALE_PAYOUT        // você vendeu um ingresso/colecionável
  ROYALTY_PAYOUT       // organizador recebendo royalty
  WITHDRAWAL           // saque via PIX (negativo)
  WITHDRAWAL_REVERSAL  // saque falhou e voltou
  ADJUSTMENT           // correção manual, sempre com descrição
}

model LedgerEntry {
  id           String          @id @default(cuid())
  userId       String          @map("user_id")
  type         LedgerEntryType
  amountBrl    Decimal         @map("amount_brl") @db.Decimal(10, 2)  // + crédito, − débito
  description  String
  purchaseId   String?         @map("purchase_id")
  withdrawalId String?         @map("withdrawal_id")
  createdAt    DateTime        @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
  @@map("ledger_entries")
}
```

Saldo é `SUM(amountBrl)` do usuário — **nunca** um campo denormalizado escrito por fora. Se a soma virar gargalo, um campo de cache atualizado dentro da mesma transação da entrada, jamais fora dela.

### 7.2 Regras

- Venda concluída (fiat) credita o vendedor com o que sobra após taxa de plataforma e royalty
- Pedido de saque debita **dentro da mesma transação** que cria o `Withdrawal`, e só depois de checar saldo disponível — senão dá para sacar duas vezes com duas abas
- `WITHDRAWAL_REVERSAL` para saque que falhou no PSP
- Toda entrada carrega `description` legível: é isso que o usuário lê no extrato

### 7.3 UI

`GET /api/me/balance` devolvendo saldo e últimas entradas. Em Minha Coleção, um `BalanceCard` **acima e visualmente separado** da lista — não é um item de coleção, é dinheiro. Usar `StatCard` como base (o filete superior em `--grad-energia` já dá o destaque certo) com ação "Sacar via PIX" abrindo `Modal`, e link para o extrato completo.

Isso resolve o incômodo original: hoje o saldo parecia mais uma linha da lista de ingressos.

---

## 8. Frente 6 — Minha Coleção: álbum e conquistas

### 8.1 Duas visualizações

Toggle **Lista ↔ Álbum**, preferência guardada em `localStorage`.

- **Lista** — o `TicketRow` atual, denso e operacional: ver QR, revender, cancelar
- **Álbum** — prateleira: peças em grade, capa em arco (`--radius-arch`, a assinatura da marca) com o filete Ouro do ticket, agrupadas por **ano** e, dentro do ano, por evento. Ingressos futuros ficam numa seção própria no topo, separados dos colecionáveis — o que está por vir não se mistura com o que já foi

Componentes novos: `ViewToggle`, `AlbumGrid`, `ShelfItem`. `ShelfItem` reaproveita o gradiente e o arco que `EventCard` e `TicketRow` já usam.

### 8.2 Conquistas

Calculadas em tempo de leitura a partir de `Ticket` + `Checkin` + `Event` — sem model novo nesta rodada. Uma função `computeAchievements(userId)` em `app/lib/achievements.ts` e um `AchievementBadge` no `ui/`:

| Conquista | Origem do dado |
|---|---|
| Você esteve lá | `Checkin` existe para o token |
| Primeiro evento | Ingresso mais antigo com check-in |
| N eventos | Contagem de check-ins |
| Cidades visitadas | `Event.city` distintas com check-in |
| Ano completo | Check-in em N meses distintos do mesmo ano |

Conquistas são **retroativas por construção** (derivam de dados históricos), então não exigem backfill.

Fora desta rodada, por depender de um model de série/turnê que não existe: "3 de 5 shows da turnê", coleção completa de festival, e afins. Quando o model existir, ele encaixa nessa mesma função sem reescrever a tela.

---

## 9. Ordem de execução

Cada bloco deixa o app rodando e buildando.

| # | Bloco | Por que nessa posição |
|---|---|---|
| A | Dados de evento (schema + seed + form do organizador) | Desbloqueia visualmente todo o resto; sem eventos passados não dá nem para testar colecionável |
| B | Home: carrossel + filtros | Puramente front sobre o schema novo; retorno visual imediato |
| C | Mercado em duas abas + colecionáveis + teto de revenda | Backend pequeno (regra de listagem e validação de preço) e front médio |
| D | **Split (dois fluxos) + atestado on-chain** + ledger + saldo | Bloco único: o ledger só faz sentido espelhando repasse que realmente acontece (§5.6). É o mais arriscado do documento — depende do jurídico (§5.7.4), de adapter real de PSP, de mudança no `TicketResale` e da escada de identificação |
| E | Álbum + conquistas | Depende de A e C para ter acervo que justifique a tela |
| F | Negociação + e-mail | Depende de D: o split precisa aceitar o preço acordado como base. Maior bloco e o único com outra dependência de infra nova (e-mail) |

---

## 10. Critérios de aceite

Por bloco, para dar para conferir sem depender de leitura de código.

**A — Dados de evento**
- [ ] Migração aplicada; `npm run build` e `npm run test` passam
- [ ] Seed cria ≥12 eventos, incluindo ao menos 3 já ocorridos e alguns com check-in feito
- [ ] Eyebrow do `EventCard` mostra categoria · subcategoria, não mais o nome da produtora
- [ ] Formulário do organizador grava categoria, subcategoria, line-up e abertura dos portões

**B — Home**
- [ ] Carrossel aparece mesmo com zero vendas registradas (fallback por `eventDate`)
- [ ] Pin do admin aparece antes dos automáticos e some ao ser limpo
- [ ] Filtros refletem na URL; recarregar ou compartilhar o link reproduz o mesmo resultado
- [ ] Evento das 21h aparece no filtro do dia dele, não do dia seguinte
- [ ] `page.tsx` continua sem `"use client"`

**C — Mercado**
- [ ] Duas abas com contagem própria; ingresso de evento futuro nunca aparece em Colecionáveis
- [ ] Ingresso `CHECKED_IN` de evento **futuro** continua sendo recusado na listagem
- [ ] Ingresso de evento **passado** pode ser listado com ou sem check-in
- [ ] Selo "Você esteve lá" aparece só onde existe `Checkin`
- [ ] Card de colecionável não mostra disponibilidade, contagem regressiva nem expiração
- [ ] Listagem acima do teto é recusada com mensagem dizendo qual é o teto
- [ ] Teto calculado sobre `Ticket.facePrice`, não sobre o preço atual do evento
- [ ] Colecionável aceita qualquer preço, mesmo com teto configurado no evento
- [ ] Evento sem `maxResaleBps` aceita qualquer preço (mercado livre, não erro)

**D — Split e saldo** *(depende das respostas do §5.7.4)*
- [ ] Revenda paga faz o valor do vendedor sair da conta da plataforma e chegar nele
- [ ] Royalty do organizador vem de `royaltyInfo()`, não de conta no backend
- [ ] Split gravado on-chain em **toda** revenda, inclusive as do fluxo Reais
- [ ] Organizador consegue conferir o royalty de uma venda sem depender de dado fornecido pela plataforma
- [ ] Extrato do organizador mostra "conferido on-chain ✓" por linha e destaca divergências
- [ ] Adulterar um valor no banco faz a linha correspondente do extrato aparecer como divergente
- [ ] Usuário com `payoutMethod = CRYPTO` recebe na mesma carteira que anunciou
- [ ] Chave PIX de terceiro é recusada: só vale chave do CPF que fez o KYC
- [ ] Trocar `pixKey` exige reautenticação e dispara aviso por e-mail
- [ ] Comprador só precisa informar CPF; nenhum comprador passa por KYC completo
- [ ] Organizador não consegue publicar o primeiro evento sem KYB
- [ ] Vendedor sem KYC completo não recebe off-ramp automático: fica com o valor a receber e é convidado a se identificar
- [ ] Venda só aparece como paga depois do PIX confirmar; antes disso o estado é "em processamento", visível em Minha Coleção
- [ ] Nome de exibição não aceita imitar terceiro; Verified aparece como identidade confirmada, não como endosso
- [ ] Saldo exibido bate com `SUM(amountBrl)` do ledger e com o extrato do PSP
- [ ] Venda concluída gera entrada de crédito com descrição legível
- [ ] Dois saques simultâneos do saldo inteiro: um passa, o outro falha por saldo insuficiente
- [ ] `BalanceCard` visualmente separado da lista — não lê como item de coleção

**E — Álbum**
- [ ] Toggle lista/álbum persiste entre visitas
- [ ] Ingressos futuros em seção própria, separados dos colecionáveis
- [ ] Conquistas conferem com os dados (nº de check-ins, cidades distintas)
- [ ] Usuário sem ingressos vê `EmptyState`, não uma grade de cadeados

**F — Negociação**
- [ ] Proposta não existe em `/events/[id]` (venda primária)
- [ ] Teto de 3 rodadas respeitado; rodada sem resposta em 24h vira `EXPIRED`
- [ ] Aceite marca as threads concorrentes como `SUPERSEDED` na mesma transação
- [ ] Aceite chama `lockListing`; tentativa de `buyListedTicket` direto no contrato reverte depois disso
- [ ] Comprador que não paga libera o anúncio via `unlockListing`
- [ ] E-mail disparado nos cinco eventos do §6.6; badge do `AppShell` bate com as pendências reais

**Não pode regredir em nenhum bloco**
- [ ] Login Privy, compra primária, revenda, cancelamento de anúncio, QR rotativo, check-in e aprovações seguem funcionando
- [ ] `npm run build` e `npm run test` passam

---

## 11. Armadilhas

1. **Não transforme `/` em Client Component.** A home faz query Prisma direto. Carrossel e filtros são Client Components filhos; a página continua Server.
2. **O contrato não sabe do preço acordado.** Aceitar negociação sem chamar `lockListing` deixa qualquer um comprar o anúncio direto on-chain pelo preço cheio, por cima de um acordo já fechado. Travar é parte do aceite, não do checkout (§6.4).
3. **Aceite de negociação é transação única.** Marcar `ACCEPTED` e `SUPERSEDED` das concorrentes no mesmo `$transaction`, relendo o status do listing dentro dela, antes de qualquer chamada on-chain.
4. **Negociação nunca aparece na venda primária.** Só sobre `Listing` de revenda; `/events/[id]` não tem proposta.
5. **Saque sem checar saldo na transação é saque duplo.** Débito e criação do `Withdrawal` no mesmo `$transaction`.
6. **Evento passado ≠ `EventStatus.ENDED`.** Nada atualiza esse status hoje; derivar por `eventDate`.
7. **Colecionável não é ingresso.** Sem contagem regressiva, sem disponibilidade, sem "expira em".
8. **Fuso horário nos filtros de data.** `eventDate` é UTC; filtrar por dia local, senão o show das 21h vira o dia seguinte.
9. **Não credite saldo antes do split existir.** Registrar crédito no ledger sem o repasse ter acontecido cria saldo que o usuário vê e não consegue sacar — pior do que não ter saldo (§5.6).
10. **Garantia opcional não é garantia.** Split verificável só no fluxo Cripto deixa de fora justamente o organizador, que é quem mais precisa conferir royalty. O atestado on-chain (§5.7.2) tem que valer para todas as vendas.
11. **Teto sobre `facePrice`, não sobre o preço do evento.** Usar o preço atual do evento faz o teto de quem comprou no lote 1 mudar retroativamente.
12. **Contraproposta do vendedor pode furar o teto.** Validar o `agreedPrice` no aceite, não só na abertura da negociação.
13. **Não aceite endereço de carteira digitado pelo vendedor.** Erro de endereço ou de rede é perda permanente, endereço não carrega identidade para validar contra o KYC, e endereço sancionado vira problema de compliance da plataforma. No fluxo Cripto o destino é a carteira que anunciou (§5.7.3).
14. **As regras de marca continuam valendo:** botão primário laranja com texto `noite-800` (nunca branco), Playfair só acima de ~20px, um CTA primário por bloco de decisão, badge sempre com rótulo textual, nenhum emoji.

---

## 12. Fora de escopo

- **Model de série/turnê** e conquistas de coleção completa — fase seguinte, encaixa na função de conquistas sem reescrita
- **Push notification (PWA)** — só e-mail e badge nesta rodada
- **Chat entre comprador e vendedor** — a negociação é deliberadamente assíncrona e estruturada
- **`TicketSwap.sol`** — o contrato de troca atômica existe no escopo de contratos e é vizinho temático do P2P, mas não tem nenhuma superfície no app; merece documento próprio
- **Responsividade mobile dedicada** — segue pendente desde o documento anterior; `/checkin` e `/my-tickets` são as telas que mais sofrem
