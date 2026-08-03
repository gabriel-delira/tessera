# Tessera Mobile — plano de construção

**Documento de arquitetura e escopo.** Descreve como eu construiria o app móvel da Tessera: stack, telas, navegação, notificações nativas e as mudanças de backend que isso exige.

- **Referência de marca:** [`docs/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)
- **Referência visual:** [`platform/preview/`](../platform/preview/)
- **Backend existente:** `app/` (Next.js 16 + Prisma 7 + Privy + indexador on-chain)

> O Brand Book dedica duas páginas inteiras (16 e 22, "Motion & Digital Experience") a mockups de **app móvel** — tela de convite, transição, confirmação de ingresso com QR. O app não é um extra: é a superfície que o Brand Book mais desenhou.

---

## 1. Por que o app existe

A jornada Tessera tem três fases: **Antes** (expectativa) · **Durante** (presença) · **Depois** (memória). O site cobre bem o *antes* — descobrir e comprar. O *durante* e o *depois* são inerentemente móveis:

- **Durante:** você entra no evento com o celular na mão. QR na fila, sinal ruim, uma mão livre.
- **Depois:** a coleção mora no bolso. É o que você abre pra rever e mostrar.

E há um gatilho que só o app resolve bem: **avisar o vendedor na hora em que alguém compra seu ingresso de revenda.** Hoje ele só descobre se abrir o site.

---

## 2. Stack recomendada

### Expo (React Native) + expo-router + Privy React Native SDK

**Por quê, concretamente para este projeto:**

1. **A API já é mobile-ready.** `app/lib/auth.ts` autentica por `Authorization: Bearer <token>` verificado pelo Privy — não há cookie, não há sessão de servidor. O app móvel consome os mesmos endpoints sem nenhuma camada de compatibilidade.
2. **Privy tem SDK React Native oficial.** A carteira embutida (`embeddedWallets.createOnLogin`) funciona igual. O usuário não gerencia chave, no site ou no app.
3. **Reuso de tipos.** Os tipos do Prisma e os contratos de API são TypeScript. Um pacote compartilhado elimina divergência entre web e mobile.
4. **Uma equipe.** O time já é React/TypeScript. Flutter ou nativo dobrariam a superfície de manutenção sem ganho proporcional — este app é orientado a formulário, lista e leitura, não a render pesado.
5. **Expo resolve o que mais dói:** push notifications com um serviço único para iOS e Android, build na nuvem (EAS), OTA updates e câmera/QR com bibliotecas mantidas.

### Quando eu **não** recomendaria Expo

Se o check-in de staff virasse leitura de alto volume (centenas de scans/minuto por porta) com hardware dedicado, o scanner nativo compensaria. Não é o caso: a leitura é uma por pessoa, no ritmo da fila.

### Dependências principais

| Pacote | Papel |
|---|---|
| `expo` + `expo-router` | Runtime e roteamento por arquivos (mesmo modelo mental do Next) |
| `@privy-io/expo` | Login e carteira embutida |
| `expo-notifications` | Push nativo (APNs/FCM por trás) |
| `expo-secure-store` | Guarda do token — Keychain/Keystore, nunca AsyncStorage |
| `expo-camera` | Scanner de QR do check-in |
| `expo-local-authentication` | Face ID/biometria para abrir o QR do ingresso |
| `@tanstack/react-query` | Cache, revalidação e estado de servidor |
| `react-native-svg` | Ícones da marca e render do QR |
| `expo-linking` | Deep links vindos das notificações |

---

## 3. Telas

Não só a home. O app cobre a jornada inteira — inclusive os papéis de organizador e staff.

### 3.1 Autenticação

| Tela | Conteúdo |
|---|---|
| **Boas-vindas** | Hero com arco + gradiente Profundidade. Frase da marca: *"Cada ingresso abre uma experiência."* Um CTA. |
| **Login** | Modal Privy em tema escuro, `accentColor` Laranja. Email ou Google. |
| **Onboarding** | 3 telas curtas: Antes / Durante / Depois — a jornada como explicação do produto. Pulável, mostrada uma vez. |

### 3.2 Descoberta — aba *Eventos*

| Tela | Conteúdo | Equivalente web |
|---|---|---|
| **Home** | Carrossel de destaques, chips de categoria, grade de próximos eventos | `/` |
| **Busca** | Campo, filtros de cidade e data, resultados | `/?q=&city=` |
| **Detalhe do evento** | Banner, descrição, organizador, disponibilidade, CTA de compra | `/events/[id]` |
| **Checkout** | Forma de pagamento (PIX / cartão / USDC), resumo, confirmação | modal em `/events/[id]` |
| **Pagamento PIX** | QR copia-e-cola, contagem regressiva, polling do status | — |
| **Sucesso da compra** | Momento-chave: gradiente Legado, animação de entrada, "Ver na minha coleção" | — |

### 3.3 Coleção — aba *Minha Coleção*

O nome importa: é o vocabulário central da marca (Ingresso → Portal → Tessera → **Coleção**).

| Tela | Conteúdo | Equivalente web |
|---|---|---|
| **Coleção** | Lista de ingressos: válidos, à venda, lembranças | `/my-tickets` |
| **Ingresso (QR)** | Tela dedicada, brilho no máximo, QR rotativo, biometria pra abrir | modal em `/my-tickets` |
| **Detalhe do ingresso** | Evento, número, preço pago, histórico on-chain, link do explorer | — |
| **Revender** | Preço, expiração, quanto você recebe (em reais, sem percentual) | modal em `/my-tickets` |
| **Lembranças** | Mosaico dos eventos já vividos — a metáfora do Brand Book, literal | — |
| **Carteira** | Saldo de revendas, histórico, sacar via PIX | parte de `/my-tickets` |

> **Lembranças é a tela mais Tessera do app.** É onde "cada Tessera é uma peça do mosaico da sua vida" deixa de ser copy e vira produto. Vale investimento de design acima da média.

### 3.4 Mercado — aba *Mercado*

| Tela | Conteúdo | Equivalente web |
|---|---|---|
| **Mercado** | Anúncios agrupados por evento, filtros e ordenação | `/market` |
| **Detalhe do anúncio** | Preço, setor, expiração, comprar | modal em `/market` |
| **Meu anúncio** | Engajamento (visualizações, carrinho, saídas), editar, cancelar | modal em `/market` |

**Regras de exibição que vêm do web e valem igual aqui:**
- A lista pública **não** mostra quanto o vendedor recebe.
- Anúncio próprio mostra **Detalhes**, não **Comprar**.
- Percentual de repasse só para admin.

### 3.5 Organizador — aba condicional (`role === ORGANIZER`)

| Tela | Conteúdo | Equivalente web |
|---|---|---|
| **Dashboard** | Receita, royalties, vendidos, próximo repasse | `/organizer` |
| **Meus eventos** | Lista com status e ações | `/organizer` |
| **Novo/editar evento** | Formulário completo | modal em `/organizer` |
| **Detalhe do evento** | Vendas ao vivo, curva por lote, check-ins em tempo real | — |
| **Solicitar cadastro** | CNPJ, carteira de repasse, status da aprovação | `/api/organizer/apply` |

### 3.6 Check-in — aba condicional (`role === STAFF | ORGANIZER`)

| Tela | Conteúdo | Equivalente web |
|---|---|---|
| **Selecionar evento/portão** | Qual porta este aparelho está cobrindo | — |
| **Scanner** | Câmera, leitura contínua, feedback háptico | `/checkin` |
| **Resultado** | Liberado / negado, em tela cheia, altíssimo contraste | `/checkin` |
| **Código manual** | Fallback quando o QR não lê | `/checkin` |
| **Histórico da sessão** | Últimos check-ins, contagem, sincronização pendente | — |

> O scanner é a tela mais hostil do app: sol na tela, pressa, uma mão. Resultado ocupa a tela inteira, com cor **e** ícone **e** texto, mais vibração distinta para sucesso e falha.

### 3.7 Conta — aba *Perfil*

| Tela | Conteúdo |
|---|---|
| **Perfil** | Email, carteira, papel |
| **Notificações** | Preferências por categoria — ver §5.6 |
| **Central de notificações** | Histórico in-app do que foi enviado |
| **Segurança** | Biometria, dispositivos conectados |
| **Ajuda / Sobre** | Suporte, termos, versão |

---

## 4. Navegação

```
Tabs (raiz)
├── Eventos       → stack: home → busca → evento → checkout → pix → sucesso
├── Mercado       → stack: lista → anúncio → meu anúncio
├── Coleção       → stack: lista → ingresso(QR) → detalhe → revender → lembranças → carteira
├── [Organizador] → stack: dashboard → evento → formulário        (condicional ao papel)
├── [Check-in]    → stack: portão → scanner → resultado           (condicional ao papel)
└── Perfil        → stack: perfil → notificações → segurança → ajuda
```

As abas de Organizador e Check-in aparecem conforme `User.role` (`BUYER | ORGANIZER | ADMIN | STAFF`), que já existe no Prisma. Um comprador vê quatro abas; um staff vê cinco.

**Admin não vai para o mobile.** Filas de aprovação, congelar evento e ver percentuais de repasse são trabalho de mesa, com contexto e conferência. Fica no web.

---

## 5. Notificações nativas

O requisito central. Hoje o backend **não tem nada** disso — nem modelo de dispositivo, nem de notificação, nem de preferência.

### 5.1 O gatilho principal: revenda vendida

O caminho já existe e é confiável. Quando alguém compra um ingresso de revenda:

1. `app/api/webhooks/psp/route.ts` recebe a confirmação de pagamento e chama `settleListedTicketOnChain`, marcando `Listing.status = SOLD` e transferindo o ticket.
2. `worker/indexer.ts` (`syncTicketResale`) observa o evento on-chain `TicketSettled` como rede de segurança e faz a mesma transição.

**Ambos os caminhos precisam emitir a notificação, e ela precisa ser idempotente** — senão o vendedor recebe o aviso duas vezes, uma por caminho. Essa é a razão principal de existir uma tabela de outbox em vez de um `sendPush()` solto no meio do handler.

### 5.2 Catálogo de eventos notificáveis

| Evento | Para quem | Urgência | Origem no código |
|---|---|---|---|
| **Seu ingresso foi vendido** | Vendedor | Alta | webhook PSP + indexer `TicketSettled` |
| Compra confirmada, ingresso emitido | Comprador | Alta | webhook PSP |
| Pagamento falhou / reembolsado | Comprador | Alta | `triggerRefund`, `reconcileStuckMinting` |
| Anúncio expira em 24h | Vendedor | Média | job agendado sobre `Listing.expiresAt` |
| Anúncio expirou | Vendedor | Baixa | job agendado |
| Evento amanhã / em 2h | Portador | Média | job agendado sobre `Event.eventDate` |
| Check-in realizado | Portador | Baixa | `/api/checkin` |
| Saque PIX concluído / falhou | Usuário | Alta | `Withdrawal.status` |
| Evento aprovado / rejeitado | Organizador | Alta | `/api/admin/events/[id]/approve` |
| Cadastro de organizador aprovado | Organizador | Alta | `/api/admin/organizers/[id]/approve` |
| Evento pausado / congelado | Portadores | Alta | `/api/admin/events/[id]/pause`, `/freeze` |
| Venda realizada (primária) | Organizador | Baixa — agregada | webhook PSP |

> A última merece cuidado: um organizador com 2.000 ingressos não pode receber 2.000 pushes. Vendas primárias vão **agregadas** ("47 ingressos vendidos hoje"), num resumo diário, nunca uma por venda.

### 5.3 Modelos Prisma a adicionar

```prisma
enum DevicePlatform { IOS ANDROID WEB }

enum NotificationCategory {
  RESALE_SOLD
  PURCHASE_CONFIRMED
  PAYMENT_FAILED
  LISTING_EXPIRING
  LISTING_EXPIRED
  EVENT_REMINDER
  CHECKIN_DONE
  WITHDRAWAL_STATUS
  ORGANIZER_APPROVAL
  EVENT_STATUS
  SALES_DIGEST
}

enum NotificationStatus { PENDING SENT FAILED READ }

model Device {
  id         String         @id @default(cuid())
  userId     String         @map("user_id")
  pushToken  String         @unique @map("push_token")
  platform   DevicePlatform
  appVersion String?        @map("app_version")
  lastSeenAt DateTime       @default(now()) @map("last_seen_at")
  createdAt  DateTime       @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("devices")
}

model Notification {
  id           String               @id @default(cuid())
  userId       String               @map("user_id")
  category     NotificationCategory
  title        String
  body         String
  data         Json?                // deep link e ids de contexto
  status       NotificationStatus   @default(PENDING)
  dedupeKey    String               @unique @map("dedupe_key")
  attempts     Int                  @default(0)
  createdAt    DateTime             @default(now()) @map("created_at")
  sentAt       DateTime?            @map("sent_at")
  readAt       DateTime?            @map("read_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([status])
  @@map("notifications")
}

model NotificationPreference {
  userId   String               @map("user_id")
  category NotificationCategory
  push     Boolean              @default(true)
  email    Boolean              @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, category])
  @@map("notification_preferences")
}
```

**`dedupeKey` é o coração da coisa.** Para a venda de revenda seria `resale_sold:<listingId>`. O webhook e o indexer tentam inserir a mesma chave; o `@unique` garante que o segundo falhe silenciosamente e o vendedor receba **um** aviso. Sem isso, a duplicação é certa, não hipotética.

### 5.4 Pipeline de entrega — padrão outbox

```
Evento de negócio (webhook / indexer / job)
  └─> INSERT em Notification (status PENDING, dedupeKey único)
        └─> worker de despacho (a cada ~5s, junto do indexer)
              ├─> lê PENDING, respeita NotificationPreference
              ├─> busca Devices do usuário
              ├─> envia (Expo Push API, lotes de 100)
              ├─> SENT / FAILED (+ attempts, backoff exponencial)
              └─> remove Device com token inválido (DeviceNotRegistered)
```

**Por que não enviar direto no handler:** o webhook do PSP roda dentro de uma transação que faz mint on-chain. Se o push falhar ou demorar, ele não pode derrubar nem atrasar a liquidação. Escrever a notificação no banco é barato e transacional; a entrega é assíncrona e pode falhar sem consequência para o dinheiro.

O worker de despacho segue o padrão que o `worker/indexer.ts` já usa — `setInterval` iniciado pelo `instrumentation.ts`. Não introduz infraestrutura nova.

### 5.5 Endpoints novos

| Método | Rota | Papel |
|---|---|---|
| `POST` | `/api/me/devices` | Registrar/atualizar push token |
| `DELETE` | `/api/me/devices/[id]` | Desregistrar (logout) |
| `GET` | `/api/me/notifications` | Histórico paginado |
| `POST` | `/api/me/notifications/[id]/read` | Marcar como lida |
| `GET` `PUT` | `/api/me/notification-preferences` | Ler/alterar preferências |

Todos protegidos pelo `getAuthUser` que já existe.

### 5.6 Preferências e permissão

**Não peça permissão de push na abertura do app.** É o erro clássico: o usuário nega e você perde o canal para sempre. Peça no primeiro momento em que a notificação tem valor óbvio:
- ao **listar um ingresso para revenda** → *"Quer que a gente te avise na hora que alguém comprar?"*
- ou logo após a **primeira compra** → *"Avisamos quando o evento estiver chegando."*

Categorias que o usuário pode desligar individualmente na tela de Notificações. **Não desligáveis:** pagamento falhou, saque, evento congelado — são avisos de dinheiro e acesso.

### 5.7 Conteúdo e deep link

```json
{
  "title": "Seu ingresso foi vendido",
  "body": "Festival Maré Alta · #1.044 — R$ 514,25 a caminho da sua carteira",
  "data": { "url": "tessera://colecao/carteira", "listingId": "clx…" }
}
```

Regras: valor sempre em reais e sem percentual (a mesma regra do mercado), voz da marca (próxima, não robótica), e todo push abre a tela exata do contexto — nunca a home.

### 5.8 iOS e Android

- **iOS:** APNs via Expo. Precisa de conta Apple Developer e chave APNs. Notificação com valor monetário deve respeitar a configuração de preview na tela bloqueada.
- **Android:** FCM via Expo. Criar canais separados por categoria (o Android permite o usuário silenciar canal a canal) — no mínimo `transacional` (alta prioridade) e `marketing` (baixa).

---

## 6. Dois problemas de arquitetura que precisam de decisão

### 6.1 O QR não funciona offline — e isso é um risco real

`app/api/me/tickets/[tokenId]/qr/route.ts` gera um payload HMAC com janela de 30 segundos, no servidor:

```
tessera:v1:<tokenId>:<janela>:<userId>:<assinatura>
```

A rotação é o que impede print e revenda de screenshot — é uma boa decisão de segurança. Mas ela implica que **sem rede não há QR**. E o cenário de uso é exatamente o pior: milhares de pessoas na mesma célula, na porta do festival, com a rede saturada.

Opções, em ordem de preferência:

1. **Pré-carregar uma janela de tokens assinados.** Ao abrir o ingresso com rede, o app baixa N tokens válidos para as próximas horas e guarda no SecureStore. Mantém o HMAC e a rotação; só antecipa a emissão. Custo: o roubo de um device dá acesso à janela pré-carregada — mitigável exigindo biometria para exibir o QR.
2. **Check-in offline no lado do staff.** O app de staff baixa a lista de tokens válidos do evento antes das portas abrirem e valida localmente, sincronizando depois. Resolve o lado que mais importa (a porta não pode parar), mas exige tratar conflito de reuso na sincronização.
3. **Aceitar a dependência de rede** e instalar Wi-Fi dedicado no evento. Mais simples no software, mais caro na operação.

Recomendo **1 + 2 combinados**. É a única combinação em que nem o portador nem a porta dependem da rede.

### 6.2 O endpoint de QR devolve PNG

Hoje ele devolve uma imagem pronta (`Content-Type: image/png`), o que faz sentido para o `<img>` do web. No mobile é desperdício: baixar um PNG a cada 28 segundos, sem poder controlar tamanho, cor ou animação de transição.

Adicionar `?format=json` retornando só o payload e o `expiresAt`, e deixar o app renderizar o QR nativamente com `react-native-svg`. Menos banda, render mais nítido, e a rotação vira uma transição suave em vez de um flash de imagem.

---

## 7. Marca no app

O design system vale integralmente. Pontos onde o móvel diverge do web:

| Aspecto | Adaptação |
|---|---|
| **Tipografia** | Playfair só em títulos de tela e momentos-manifesto. Em cartão de lista, Playfair a partir de ~18px. Inter em todo o resto. |
| **Escala** | A escala do Brand Book é desktop (H1 72–96px). No app, título de tela fica em 28–34px. |
| **Alvos de toque** | Mínimo 44×44pt. O `.btn` de 44px do preview já atende. |
| **Arco** | `--radius-arch` em capas de card e no topo de telas de destaque. É a assinatura da marca — mas não em tudo. |
| **Mosaico** | Textura de quadrifólio em Ouro a 4–8% em heroes e estados vazios. A tela de Lembranças é onde ele deve aparecer com força. |
| **Movimento** | Brand Book p.16: entrada, transição, microinteração, feedback. Confirmação de compra e check-in aprovado merecem os 700ms de `--dur-hero` e o gradiente Legado. |
| **Logo** | Mínimo **24px** em app (`DESIGN_SYSTEM.md` §5.4). Ícone do app: símbolo isolado sobre Noite. |
| **Splash** | Noite `#0C1324` com o símbolo em Ouro. |

Os tokens viram um arquivo `theme.ts` no app — mesmos valores, exportados como objeto TypeScript.

---

## 8. Fases

| Fase | Escopo | Entrega |
|---|---|---|
| **0 — Fundação** | Expo + expo-router, tema, componentes base, Privy, navegação por abas | App logando e navegando, sem dados |
| **1 — Leitura** | Home, busca, detalhe do evento, coleção, mercado | App útil para consultar |
| **2 — Transação** | Checkout, PIX, revenda, carteira, saque | Paridade com o web para comprador |
| **3 — Notificações** | Modelos Prisma, worker de despacho, endpoints, registro de device, preferências, deep links | **Vendedor avisado na hora da venda** |
| **4 — Papéis** | Dashboard do organizador, check-in com scanner | Paridade com o web (menos admin) |
| **5 — Alma** | Lembranças, movimento, offline do QR, biometria | O *depois* da jornada |

A Fase 3 é a que justifica o app. As fases 1 e 2 são pré-requisito dela — não dá pra notificar sobre uma venda que o app não sabe exibir.

---

## 9. Mudanças necessárias no backend

Resumo do que o `app/` precisa ganhar para sustentar o mobile:

**Novo**
- [ ] Modelos `Device`, `Notification`, `NotificationPreference` + migração
- [ ] Worker de despacho de push (junto do indexer, via `instrumentation.ts`)
- [ ] Endpoints de device, notificações e preferências (§5.5)
- [ ] Jobs agendados: lembrete de evento, anúncio expirando, resumo diário do organizador
- [ ] `GET /api/me/tickets/[tokenId]/qr?format=json`

**Alterado**
- [ ] `webhooks/psp/route.ts` — enfileirar notificação na liquidação de revenda
- [ ] `worker/indexer.ts` — enfileirar na `TicketSettled` (mesma `dedupeKey`, deduplicada pelo banco)
- [ ] `api/checkin/route.ts` — enfileirar "check-in realizado"
- [ ] `api/admin/**` — enfileirar aprovações e mudanças de status
- [ ] `api/withdrawals/route.ts` — enfileirar mudança de status do saque
- [ ] CORS para a origem do app (se aplicável ao esquema de deploy)

**Nenhuma mudança necessária**
- Autenticação: `lib/auth.ts` já é Bearer + Privy, funciona como está
- Contratos: nada on-chain muda
- Endpoints de leitura: catálogo, evento, mercado e tickets já servem JSON

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| **QR sem rede na porta do evento** | §6.1 — pré-carregar tokens + validação offline do staff. **Decidir antes da Fase 5.** |
| **Push duplicado (webhook + indexer)** | `dedupeKey` único no banco |
| **Usuário nega push na primeira tela** | Pedir permissão no momento de valor, nunca na abertura |
| **Inundar organizador com pushes de venda** | Agregação em resumo diário |
| **Revisão da App Store por conteúdo cripto** | O produto é ingresso, não investimento. Não expor "NFT", "carteira" nem "USDC" como conceito primário na UI — a carteira embutida do Privy já é invisível para o usuário. Vocabulário: *ingresso*, *coleção*, *saldo*. |
| **Divergência de regra entre web e mobile** | Regras de exibição (não mostrar repasse ao comprador; percentual só admin) documentadas nos dois planos e idealmente centralizadas no backend, não no cliente |
| **Deriva visual entre plataformas** | `theme.ts` gerado a partir dos mesmos tokens do `DESIGN_SYSTEM.md` |

---

## 11. O que este documento não decide

- **Analytics e observabilidade** — que eventos instrumentar, qual ferramenta.
- **Loja e distribuição** — contas Apple/Google, política de privacidade, screenshots, TestFlight.
- **i18n** — o app nasce só em pt-BR; internacionalizar depois é caro.
- **Modo claro** — o app é Noite. A composição clara do Brand Book é território editorial.
- **Pagamento in-app** — PIX e cartão vão por PSP externo, fora do IAP. Vale confirmar o enquadramento nas regras da Apple: venda de ingresso para evento físico é bem estabelecida como fora do IAP, mas a redação da submissão importa.
