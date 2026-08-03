# App web (`app/`) — migração para o Design System Tessera

**Documento de execução.** Descreve o que precisa mudar no app Next.js para ele deixar de ser um scaffold sem marca e virar a Tessera.

- **Referência normativa:** [`docs/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)
- **Referência visual:** [`platform/preview/`](../platform/preview/) — o preview estático já está 100% no design system e serve de gabarito de HTML/CSS para cada tela.
- **Alvo:** `app/` — Next.js 16.2.9, React 19.2.4, Tailwind 4, Prisma 7, Privy.

> ⚠️ **Antes de escrever qualquer código:** `app/AGENTS.md` avisa que esta versão do Next.js tem breaking changes em relação ao que os modelos conhecem. Rode `npm install` e leia os guias em `node_modules/next/dist/docs/` antes de mexer em roteamento, `layout`, `metadata` ou Server Components. Este documento descreve **o que** mudar e **por quê**; a API exata do Next 16 você confirma lá.

---

## 1. Diagnóstico

O app **funciona** — venda primária, revenda, check-in, indexador on-chain, webhooks. O problema é exclusivamente de apresentação: nenhuma decisão de marca chegou nele.

### 1.1 O `globals.css` nunca foi tocado

```css
/* app/app/globals.css — estado atual, na íntegra */
:root { --background: #ffffff; --foreground: #171717; }
@media (prefers-color-scheme: dark) { :root { --background: #0a0a0a; --foreground: #ededed; } }
body { font-family: Arial, Helvetica, sans-serif; }
```

Isto é o scaffold padrão do `create-next-app`. Branco, cinza-quase-preto e **Arial**. Zero relação com Noite, Laranja, Ouro, Playfair ou Inter.

### 1.2 Fontes erradas

`layout.tsx` carrega **Geist** e **Geist Mono** (as fontes da Vercel). O design system pede **Playfair Display** (títulos) e **Inter** (interface).

### 1.3 Não existe chrome compartilhado

`app/page.tsx` desenha o próprio cabeçalho inline (linhas 39–47), com `◆ Tessera` como logo — o mesmo losango genérico que já removemos do preview. As outras seis telas cada uma resolve o cabeçalho do seu jeito. Não há `<AppShell>`, não há navegação única, não há rodapé.

Consequência prática: qualquer ajuste de navegação hoje precisa ser feito sete vezes.

### 1.4 Paleta hardcoded do Tailwind padrão

As telas usam `bg-black`, `text-white`, `text-zinc-400`, `text-zinc-500`, `bg-zinc-100`, `text-red-500`, `border`. São utilitários do tema padrão do Tailwind, não tokens da marca.

### 1.5 Privy em tema claro

`providers.tsx` configura `appearance: { theme: "light" }`. O modal de login — primeira tela que todo usuário vê — aparece branco no meio de um app Noite.

### 1.6 Inventário de telas

| Rota | Arquivo | Linhas | Tipo | Gabarito no preview |
|---|---|---|---|---|
| `/` | `app/page.tsx` | 112 | Server | `index.html` |
| `/events/[id]` | `app/events/[id]/page.tsx` | 197 | Server | `evento.html` |
| `/market` | `app/market/page.tsx` | 276 | Client | `mercado.html` |
| `/my-tickets` | `app/my-tickets/page.tsx` | 182 | Client | `ingressos.html` |
| `/organizer` | `app/organizer/page.tsx` | 200 | Client | `organizador.html` |
| `/admin` | `app/admin/page.tsx` | 158 | Client | `admin.html` |
| `/checkin` | `app/checkin/page.tsx` | 194 | Client | `checkin.html` |

Total: ~1.320 linhas de UI. Nenhuma delas com marca.

---

## 2. Estratégia

**Tokens primeiro, componentes depois, telas por último.** Cada fase deixa o app rodando.

```
Fase 0  Fontes + tokens no globals.css (Tailwind 4 @theme)
Fase 1  AppShell — nav, logo, rodapé, um só lugar
Fase 2  Biblioteca de componentes (Button, Card, Badge, Panel, Modal, Ticket…)
Fase 3  Migração tela a tela
Fase 4  Privy, metadata, favicon, acessibilidade
```

**Regra de ouro:** o preview estático é o gabarito. Antes de estilizar uma tela, abra o HTML correspondente em `platform/preview/` e replique a estrutura. Não reinvente — o trabalho de design já foi feito e validado visualmente.

---

## 3. Fase 0 — Fontes e tokens

### 3.1 Fontes em `layout.tsx`

Trocar Geist/Geist_Mono por Playfair Display + Inter, mantendo o padrão `next/font/google` (que já está em uso e evita FOUT):

```tsx
import { Playfair_Display, Inter } from "next/font/google";

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
```

Também corrigir `<html lang="en">` → **`lang="pt-BR"`**. O app inteiro é em português; `lang="en"` quebra leitores de tela e hifenização.

### 3.2 Tokens em `globals.css`

Tailwind 4 define tokens **no CSS**, via `@theme` — não existe `tailwind.config.js` neste projeto e não se deve criar um. Substituir o `globals.css` inteiro por:

```css
@import "tailwindcss";

@theme {
  /* Marca (Brand Book, p.12) */
  --color-noite:   #0C1324;
  --color-violeta: #6B2FA3;
  --color-laranja: #FF6A00;
  --color-ouro:    #C79A4A;
  --color-pedra:   #E6D7BE;
  --color-luz:     #FAF7F2;

  /* Rampas */
  --color-noite-900: #060B16;
  --color-noite-800: #0C1324;
  --color-noite-700: #131D33;
  --color-noite-600: #1B2743;
  --color-noite-500: #243254;
  --color-noite-400: #35456B;

  --color-violeta-700: #4E2178;
  --color-violeta-600: #6B2FA3;
  --color-violeta-500: #8248BE;
  --color-violeta-400: #9161C9;
  --color-violeta-300: #A87BD8;
  --color-violeta-200: #C6A8E6;

  --color-laranja-700: #A63F00;
  --color-laranja-600: #C24E00;
  --color-laranja-500: #FF6A00;
  --color-laranja-400: #FF8C3F;
  --color-laranja-300: #FFB07A;

  --color-ouro-700: #7A5A22;
  --color-ouro-600: #A07A35;
  --color-ouro-500: #C79A4A;
  --color-ouro-400: #D9B37A;
  --color-ouro-300: #E8CEA3;

  --color-pedra-700: #A8926C;
  --color-pedra-600: #CBB794;
  --color-pedra-500: #E6D7BE;
  --color-pedra-400: #EFE5D5;
  --color-luz-600:   #F0EAE0;
  --color-luz-500:   #FAF7F2;

  /* Estado */
  --color-sucesso: #2F8F63;
  --color-sucesso-on-dark: #4FBF8B;
  --color-sucesso-on-light: #1F6B49;
  --color-erro: #C4392A;
  --color-erro-on-dark: #E8705F;
  --color-erro-on-light: #A32B1C;
  --color-aviso: #C79A4A;
  --color-aviso-on-dark: #D9B37A;
  --color-aviso-on-light: #7A5A22;

  /* Semântica */
  --color-bg: #0C1324;
  --color-surface: #131D33;
  --color-surface-2: #1B2743;
  --color-border: #243254;
  --color-border-strong: #35456B;
  --color-text: #FAF7F2;
  --color-text-muted: #A8B2C6;

  /* Tipografia */
  --font-display: var(--font-display), Georgia, serif;
  --font-sans: var(--font-ui), system-ui, sans-serif;

  /* Forma */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 20px;

  /* Movimento */
  --ease-out-brand: cubic-bezier(.16, 1, .3, 1);
}

/* Gradientes — não viram utilitário automático, ficam como custom props */
:root {
  --grad-profundidade: linear-gradient(135deg, #0C1324 0%, #6B2FA3 100%);
  --grad-energia:      linear-gradient(135deg, #6B2FA3 0%, #FF6A00 100%);
  --grad-legado:       linear-gradient(135deg, #FF6A00 0%, #C79A4A 100%);
  --radius-arch: 50% 50% 12px 12px / 34% 34% 12px 12px;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

:focus-visible {
  outline: 2px solid var(--color-ouro-400);
  outline-offset: 2px;
  border-radius: inherit;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Remover** o bloco `@media (prefers-color-scheme: dark)`. O app tem **um** tema — Noite. Alternância clara/escura não está no escopo e o Brand Book trata a composição clara como território editorial/impresso, não de produto.

Depois disso, `bg-noite-700`, `text-ouro-400`, `border-noite-500` etc. passam a existir como utilitários Tailwind.

---

## 4. Fase 1 — AppShell

Criar `app/components/AppShell.tsx` e usá-lo no `layout.tsx`, eliminando os sete cabeçalhos.

Responsabilidades:
- **Topbar** — logo (SVG do arco + quadrifólio, o mesmo de `platform/preview/index.html`), navegação, ação de login/conta
- **Estado ativo da rota** — filete inferior de 2px em Laranja (usar `usePathname()`)
- **Rodapé** — versão rica na home, simples nas demais
- **Nav condicional por papel** — hoje `/organizer` e `/admin` aparecem para todo mundo; o `User.role` (`BUYER | ORGANIZER | ADMIN | STAFF`) do Prisma já existe e deve filtrar os itens

O logo mínimo é **32px** em web (`DESIGN_SYSTEM.md` §5.4). Extrair o SVG para `app/components/Logo.tsx`, com prop de tamanho.

> A navegação é interativa (`usePathname`, estado de login), então o AppShell é Client Component. Mantenha-o fino: só o chrome. As páginas continuam Server Components onde já são — `/` e `/events/[id]` fazem query Prisma direto e devem continuar assim.

---

## 5. Fase 2 — Componentes

Criar `app/components/ui/`. Cada componente traduz uma classe já validada no preview — o CSS de referência está em `platform/preview/styles.css`.

| Componente | Origem no preview | Observações |
|---|---|---|
| `Button` | `.btn` + variantes | Variantes: `primary`, `secondary`, `ghost`, `premium`, `danger`, `success`. **Texto do primário é Noite, nunca branco.** |
| `Card` / `EventCard` | `.card` | Capa com `--radius-arch`; chip de data e badge **fora** da capa (senão o arco os corta) |
| `Badge` | `.badge` + cores | `success`, `error`, `warning`, `info`, `neutral`. Sempre com texto, nunca só cor. |
| `Panel` | `.panel` | Cabeçalho em Playfair + corpo |
| `Modal` | `.modal` | No app vira modal real (estado React + `<dialog>` ou portal), não `:target`. Precisa de foco preso, `Esc` para fechar e retorno de foco. |
| `Field` | `input.field` | Label sempre visível, erro abaixo, foco em Ouro |
| `StatCard` | `.stat` | Filete superior com `--grad-energia`, números `tabular-nums` |
| `TicketRow` | `.ticket` | Filete Ouro interno — assinatura do ticket Tessera |
| `EmptyState` | `.empty` | Símbolo + título Playfair + ação |
| `Icon` | sprite SVG | Portal, ticket, quadrifólio, coluna, escudo, local, calendário… |
| `PageTitle` | `.page-title` | Playfair, com suporte a ênfase colorida (`<em>` em Laranja) |

### Ícones

O preview inlina um sprite `<svg><defs>` por arquivo porque não tem build step. No app, isso vira um componente `Icon` com um mapa de paths, ou SVGR. **Emoji continua proibido** — não aceita cor da paleta e renderiza diferente por SO.

### Modal — atenção

Os modais do preview usam `:target`, que é um truque de HTML estático. No app eles são estado React e precisam do que o preview não tinha: `role="dialog"`, `aria-modal`, foco preso dentro do modal, fechar com `Esc`, e devolver o foco ao gatilho ao fechar.

---

## 6. Fase 3 — Migração das telas

Ordem sugerida (menor risco → maior):

1. **`/`** (catálogo) — Server Component simples, gabarito `index.html`. Hoje é uma grade de cards com `border` e `bg-zinc-100`; vira `EventCard` com capa em arco, chip de data, eyebrow de categoria em Ouro e título em Playfair.
2. **`/events/[id]`** — gabarito `evento.html`. Banner com gradiente + mosaico, painéis, CTA primário em Laranja.
3. **`/my-tickets`** — gabarito `ingressos.html`. **Renomear para "Minha Coleção"** em toda a UI: é o vocabulário central da marca (Ingresso → Portal → Tessera → Coleção). A rota pode continuar `/my-tickets`.
4. **`/market`** — gabarito `mercado.html`. Inclui as duas regras de negócio que já decidimos no preview:
   - Anúncio do próprio usuário mostra **Detalhes** em vez de **Comprar**
   - **Não existe coluna "Você recebe"** na tabela pública — comprador não vê o repasse do vendedor. Esse número só aparece no modal de Detalhes do dono, e **em reais, sem percentual**. O percentual é exclusivo de admin.
5. **`/organizer`** — gabarito `organizador.html`. Stats + tabela de eventos.
6. **`/admin`** — gabarito `admin.html`. Filas de aprovação. **É a única tela onde o percentual de repasse pode aparecer.**
7. **`/checkin`** — gabarito `checkin.html`. Tela de staff, pensada para celular: alvos de toque ≥44px, alto contraste, resultado ok/fail muito legível a um braço de distância.

### Placeholder de capa

`page.tsx` hoje renderiza `sem imagem` num quadrado `bg-zinc-100` quando `coverImageUrl` é nulo. Substituir pelo padrão do preview: gradiente da marca (`--grad-energia` / `--grad-profundidade` / `--grad-legado`, alternando por evento) com o quadrifólio em Ouro a ~20% de opacidade. Vira textura de marca em vez de buraco.

---

## 7. Fase 4 — Acabamento

### Privy

```tsx
appearance: {
  theme: "dark",
  accentColor: "#FF6A00",
  logo: "<url do logo Tessera>",
}
```

É a primeira tela do usuário. Hoje é branca no meio de um app escuro.

### Metadata e favicon

`layout.tsx` já tem título e descrição corretos. Falta:
- **Favicon** — `app/favicon.ico` ainda é o do Next.js. Trocar pelo símbolo isolado da Tessera; o mínimo é **16px** (`DESIGN_SYSTEM.md` §5.4).
- **Open Graph** — sem imagem OG, todo link compartilhado aparece cru. Vale gerar dinamicamente por evento (Next tem API para isso; confirme a forma no Next 16).
- **`theme-color`** — `#0C1324`, para a barra do navegador móvel combinar com o app.

### Acessibilidade

Não é opcional e o preview já estabeleceu o padrão:
- Foco visível em Ouro (já no `globals.css` da Fase 0)
- Nenhum botão primário com texto branco (2.69:1 reprova)
- `violeta-300` para texto violeta sobre escuro, nunca `violeta-600` (2.26:1 reprova)
- Badges sempre com rótulo textual
- `prefers-reduced-motion` respeitado

---

## 8. Critérios de aceite

**Higiene**
- [ ] `globals.css` não tem mais `#ffffff`, `#171717`, `#0a0a0a`, `#ededed` nem `Arial`
- [ ] Nenhuma ocorrência de `zinc-`, `bg-black`, `text-white`, `text-red-500` nas telas
- [ ] `◆ Tessera` não existe mais em lugar nenhum
- [ ] Nenhum emoji na UI

**Marca**
- [ ] Playfair em todos os títulos; Inter em toda a interface funcional
- [ ] AppShell único; nenhuma página desenha o próprio cabeçalho
- [ ] Logo SVG ≥32px no topo e no rodapé
- [ ] Capas de card com `--radius-arch`
- [ ] "Meus Ingressos" virou "Minha Coleção" na UI
- [ ] `<html lang="pt-BR">`

**Regras de negócio de exibição**
- [ ] Tabela pública do mercado **não** mostra quanto o vendedor recebe
- [ ] Anúncio próprio mostra "Detalhes", não "Comprar"
- [ ] Percentual de repasse aparece **só** em `/admin`

**Acessibilidade**
- [ ] Nenhum `.btn` primário com texto branco
- [ ] Foco visível navegando por Tab nas 7 rotas
- [ ] Modais com foco preso, `Esc` e retorno de foco
- [ ] `prefers-reduced-motion` respeitado

**Funcional — nada pode regredir**
- [ ] Login Privy, compra primária, revenda, cancelamento de anúncio, QR rotativo, check-in e aprovações continuam funcionando
- [ ] `npm run build` e `npm run test` passam

---

## 9. Armadilhas

1. **Texto branco em botão laranja.** O reflexo é `text-white`. Reprova (2.69:1). É `text-noite-800`.
2. **Tailwind 4 não usa `tailwind.config.js`.** Tokens vão em `@theme` no CSS. Não crie o arquivo de config.
3. **Não transforme Server Components em Client.** `/` e `/events/[id]` fazem query Prisma direto no servidor. Estilizar não exige `"use client"` — se você adicionar isso no topo, quebra o acesso ao banco.
4. **O arco corta filhos posicionados.** `--radius-arch` + `overflow: hidden` corta chip de data e badge. Eles ficam fora da capa, como filhos do card. Foi exatamente o bug que apareceu no preview.
5. **Playfair só acima de ~20px.** Label, badge, tabela, botão e navegação são Inter.
6. **Violeta é 20% da composição, Laranja é 15%.** Laranja é ação, não decoração. Um CTA primário por bloco de decisão.
7. **Não "conserte" o hex do Violeta.** É `#6B2FA3`. O Brand Book imprime `#0B2FA3` por erro de digitação (`DESIGN_SYSTEM.md` §10.1).

---

## 10. O que este documento não cobre

- **Responsividade real.** O preview é desktop-first e o app herda isso. As telas de `/checkin` e `/my-tickets` são usadas em pé, na fila, com uma mão — merecem passe dedicado de mobile web.
- **Skeletons e estados de carregamento.** Hoje `/my-tickets` usa `animate-pulse` genérico. Vale um padrão de marca.
- **Tratamento de erro na UI.** Não há padrão de toast/alerta. Sugestão: componente `Alert` usando as cores de estado.
- **App móvel nativo.** Ver [`MOBILE_APP_PLAN.md`](./MOBILE_APP_PLAN.md).
