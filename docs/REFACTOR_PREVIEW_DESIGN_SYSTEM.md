# Refactor: `platform/preview` → Design System Tessera

**Documento de execução.** Escrito para um agente implementar sem precisar reler o Brand Book.

- **Referência normativa:** [`docs/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — toda decisão de cor, tipo, forma e componente vem de lá.
- **Alvo:** `platform/preview/` — 7 arquivos HTML + 1 CSS (408 linhas).
- **Natureza:** preview estático, sem backend, sem build step. Dados são falsos e permanecem falsos.

> ## ✅ Status: executado
>
> O refactor descrito abaixo **já foi aplicado**. Todos os critérios de aceite da seção 11 passam. Este documento fica como registro da decisão e referência para as próximas telas.
>
> **Três ajustes que só apareceram ao renderizar** e que não estavam no plano original:
>
> 1. **`--radius-arch` como semicírculo clipava os filhos.** Com `9999px 9999px` a capa do card virava uma cúpula perfeita, e `overflow: hidden` cortava o chip de data e o badge de status em triângulos. Corrigido de duas formas: o raio virou um **arco elíptico** (`50% 50% 12px 12px / 34% 34% 12px 12px`), que lê como arco arquitetônico em vez de meia-lua; e o chip de data e o `.badge.float` passaram a ser **filhos diretos de `.card`**, não de `.cover`, para escapar do clipping.
> 2. **`.badge.float` sumia sobre as capas claras.** O fundo translúcido de 14% das variantes de status não sobrevive sobre o gradiente Laranja→Ouro. Ganhou fundo opaco `rgba(6,11,22,.82)` com borda Ouro, declarado **depois** das variantes de cor para vencer na cascata (a especificidade é igual).
> 3. **O gap do carrossel saiu do JS.** Em vez de manter o `22` codificado, virou o token `--carousel-gap`, lido pelo script via `getComputedStyle`. A armadilha nº 5 desta lista deixou de existir.

---

## 1. Objetivo

O preview hoje é de outra marca. Ele foi feito como "Shaar" com uma identidade neon (roxo/magenta/ciano sobre quase-preto) que não tem relação com a Tessera. O objetivo é que **qualquer pessoa que abra o preview reconheça a Tessera** — paleta, tipografia, formas e voz.

### Fora de escopo

- Não adicionar framework, bundler, npm, Tailwind ou pré-processador. Continua HTML + CSS puro, abrindo por `file://`.
- Não mudar arquitetura de informação: as 7 telas, seus links e seus fluxos permanecem.
- Não trocar os dados falsos por dados reais nem conectar API.
- Não redesenhar o logo. Use o símbolo SVG entregue na seção 7.

---

## 2. Diagnóstico

Estado atual de `styles.css` (`:root`, linhas 2–22) contra o design system:

| Aspecto | Hoje | Deve ser |
|---|---|---|
| Fundo | `#0a0710` (quase-preto arroxeado) | `#0C1324` **Noite** (azul profundo) |
| Acento primário | `#a855f7` violeta neon | `#FF6A00` **Laranja** (ação) |
| Acentos extras | `#d63af0` magenta, `#ff2d78` hot pink, `#24e0d4` ciano, `#4f7bff` azul | **Não existem na marca.** Remover. |
| Ouro | `#ffca45` (amarelo saturado) | `#C79A4A` **Ouro** (metálico, dessaturado) |
| Gradiente de marca | `pink → violeta → azul` | `noite→violeta`, `violeta→laranja`, `laranja→ouro` |
| Tipografia | `"Segoe UI", system-ui` para tudo | **Playfair Display** (títulos) + **Inter** (interface) |
| Títulos | `font-weight: 800/900`, `letter-spacing: -1px` | Playfair, entrelinha 1.05, sem tracking negativo |
| Ícones | 67 emojis em 7 arquivos (44 só no `index.html`) | Sistema de ícones em SVG linear |
| Nome | "Shaar" em 8 arquivos, 17 ocorrências | "Tessera" |
| Foco | Nenhum `:focus-visible` | Anel Ouro obrigatório |
| Movimento reduzido | Não tratado | `prefers-reduced-motion` obrigatório |

**Problema de acessibilidade herdado, importante:** os botões atuais usam `color: #fff` sobre gradiente rosa/violeta e sobre laranja. Branco sobre `#FF6A00` rende **2.69:1 — reprova em WCAG AA**. Ao trocar para laranja, o texto do botão primário **tem que virar Noite `#0C1324`** (6.45:1). Este é o erro mais provável do refactor inteiro.

---

## 3. Estratégia

**Token-first.** ~85% do trabalho está em `styles.css`; o HTML muda pouco (nome, ícones, alguns títulos).

Ordem de execução — cada fase deixa o preview funcionando:

```
Fase 0  Fontes + bloco de tokens
Fase 1  Reescrever :root e mapear variáveis antigas → novas
Fase 2  Tipografia (Playfair/Inter aplicados por seletor)
Fase 3  Componentes (botões, cards, badges, painéis, ticket)
Fase 4  Formas de marca (arco, filete ouro, mosaico)
Fase 5  HTML: nome, ícones SVG, microcópia
Fase 6  Acessibilidade e verificação
```

---

## 4. Fase 0 — Fontes e tokens

### 4.1 Fontes

Adicionar em `<head>` dos **7** arquivos HTML, antes de `<link rel="stylesheet" href="styles.css">`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

> O preview roda em `file://`. As fontes vêm da rede; sem internet o fallback (`Georgia` / `system-ui`) assume. Aceitável para preview. Se for exigido funcionar offline, baixar os `.woff2` para `platform/preview/fonts/` e usar `@font-face` — mas **não faça isso sem pedir**, é mudança de escopo.

### 4.2 Tokens

Substituir o bloco `:root` inteiro (linhas 2–22 de `styles.css`) pelo bloco de tokens da **seção 9 do `DESIGN_SYSTEM.md`**. Copie-o na íntegra, não uma versão resumida.

---

## 5. Fase 1 — Mapa de substituição

Todas as variáveis antigas devem sumir. Use esta tabela como referência de tradução; **não** deixe alias das antigas apontando para as novas — o objetivo é que nenhum `#a855f7` sobreviva no arquivo.

| Antigo | Novo | Observação |
|---|---|---|
| `--bg: #0a0710` | `--bg: var(--noite-800)` | |
| `--bg-2: #120b1c` | `--bg-deep: var(--noite-900)` | |
| `--surface: #16101f` | `--surface: var(--noite-700)` | |
| `--surface-2: #1f1730` | `--surface-2: var(--noite-600)` | |
| `--border: #2d2442` | `--border: var(--noite-500)` | |
| `--text: #f3effb` | `--text: var(--luz-500)` | |
| `--muted: #9a90ad` | `--text-muted: #A8B2C6` | 8.68:1 sobre Noite |
| `--accent: #a855f7` | `--action: var(--laranja-500)` | **muda de papel:** era violeta decorativo, vira laranja de ação |
| `--accent-2: #d63af0` | `--text-accent: var(--ouro-400)` | magenta → ouro |
| `--pink: #ff2d78` | *(remover)* | não existe na marca |
| `--cyan: #24e0d4` | *(remover)* | não existe na marca |
| `--gold: #ffca45` | `var(--ouro-500)` | |
| `--green: #26d07c` | `var(--sucesso-on-dark)` = `#4FBF8B` | |
| `--red: #ff4d5e` | `var(--erro-on-dark)` = `#E8705F` | |
| `--yellow: #ffca45` | `var(--aviso-on-dark)` = `#D9B37A` | |
| `--brand-grad` | `var(--grad-energia)` | violeta→laranja |
| `--glow` | `var(--glow-ouro)` | |
| `--radius: 16px` | `var(--radius-lg)` = 12px | mais arquitetônico, menos "bolha" |

### Fundo do `body`

Trocar os dois `radial-gradient` magenta/azul (linhas 25–29) por atmosfera Noite→Violeta, respeitando a proporção 40/20 do Brand Book:

```css
body {
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(107,47,163,.22), transparent 60%),
    radial-gradient(1000px 500px at -10% 10%, rgba(107,47,163,.12), transparent 55%),
    var(--bg);
  background-attachment: fixed;
  color: var(--text);
  font-family: var(--font-ui);
  line-height: var(--lh-body);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
```

### Gradientes utilitários `.g1`–`.g4`

Usados como capa de card e banner. Substituir (linhas 349–352):

```css
.g1 { background: var(--grad-energia); }        /* violeta → laranja */
.g2 { background: var(--grad-profundidade); }   /* noite → violeta   */
.g3 { background: var(--grad-legado); }         /* laranja → ouro    */
.g4 { background: linear-gradient(135deg, #1B2743, #4E2178); } /* noite → violeta escuro */
```

Nos HTMLs, os `style="--hero-grad:linear-gradient(...)"` inline do carrossel (`index.html`, linhas 37, 54, 71, 88, 105) precisam ser reescritos para os três gradientes de marca — cicle entre eles, não invente novos.

---

## 6. Fase 2 — Tipografia

```css
h1, h2, h3, .page-title, .hero h1, .banner h1, .section-head h2, .card h3, .modal h3 {
  font-family: var(--font-display);
  font-weight: 500;
  line-height: var(--lh-heading);
  letter-spacing: 0;      /* remover todo letter-spacing negativo */
}
.page-title { font-size: var(--fs-h2); line-height: var(--lh-display); }
.hero h1, .banner h1 { font-size: var(--fs-h1); line-height: var(--lh-display); font-weight: 600; }
.section-head h2 { font-size: var(--fs-h3); }
.card h3 { font-size: 1.3125rem; font-weight: 500; }
```

Regras a aplicar em varredura:

1. **Remover todo `letter-spacing` negativo** do arquivo (aparece em `.logo`, `.page-title`, `.section-head h2`, `.hero h1`, `.banner h1`, `.card h3`, `.price`, `.stat .value`). Playfair não suporta tracking apertado.
2. **Remover `font-weight: 800/900`** de títulos. Playfair 500–600 já tem presença.
3. Eyebrows (`.card-cat`, `.stat .label`, `th`, `.hero-tag`, `.banner-tag`): Inter Semibold, 11px, `letter-spacing: .12em`, caixa alta, cor `var(--ouro-400)`.
4. `.price`, `.stat .value`: manter **Inter** (não Playfair) e adicionar `font-variant-numeric: tabular-nums`.
5. Botões, navegação, tabelas, formulários, badges: **sempre Inter**.

### Ênfase colorida em títulos

Assinatura da marca. Adicionar a classe e usá-la com parcimônia (no máximo um trecho por título):

```css
.em-laranja { color: var(--laranja-400); }
.em-violeta { color: var(--violeta-300); }
```

Exemplo em `index.html`: `<h2>Próximos <span class="em-laranja">eventos</span></h2>`.

---

## 7. Fase 3 — Componentes

### 7.1 Botões — a parte mais crítica

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 0 24px; height: 44px;
  border: none; border-radius: var(--radius-md);
  background: var(--action);
  color: var(--on-action);          /* #0C1324 — NÃO branco */
  font-family: var(--font-ui); font-size: 15px; font-weight: 600;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out),
              transform var(--dur-fast) var(--ease-out);
}
.btn:hover { background: var(--action-hover); transform: translateY(-1px); }

.btn.secondary {
  background: transparent; color: var(--text); border: 1px solid var(--border-strong);
}
.btn.secondary:hover { background: rgba(250,247,242,.06); border-color: var(--ouro-500); }

.btn.ghost { background: transparent; color: var(--text-muted); border: none; }
.btn.ghost:hover { color: var(--text); }

.btn.premium { background: var(--grad-legado); color: var(--on-action); }

.btn.danger {
  background: transparent; color: var(--erro-on-dark); border: 1px solid var(--erro-on-dark);
}
.btn.danger:hover { background: rgba(232,112,95,.12); }

.btn.green { background: var(--sucesso-on-dark); color: var(--noite-800); }
.btn.sm { height: 36px; padding: 0 16px; font-size: 14px; }
.btn[disabled] { opacity: .45; cursor: not-allowed; transform: none; }
```

> ⚠️ **Verifique explicitamente**: nenhum `.btn` pode ter `color: #fff` ou `color: white`. O `.hero .btn` atual (linhas 137–138) força `background:#fff; color:#17101f` — substituir por `background: var(--action); color: var(--on-action);`.

### 7.2 Logo

O `.logo::before` atual usa `content: "◆"` com gradiente. Substituir pelo símbolo real — arco com quadrifólio, em SVG inline. Adicionar em cada `<header class="topbar">` e no rodapé:

```html
<a class="logo" href="index.html">
  <svg class="logo-mark" viewBox="0 0 32 40" width="26" height="32" aria-hidden="true" fill="none"
       stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 38V16a12 12 0 0 1 24 0v22"/>
    <rect x="10" y="14" width="12" height="20" rx="2"/>
    <path d="M16 20a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 1 1 0-5.2Z
             M13.4 22.6a2.6 2.6 0 1 1 5.2 0 2.6 2.6 0 1 1-5.2 0Z"/>
    <path d="M2 38h28"/>
  </svg>
  <span>TESSERA</span>
</a>
```

```css
.logo { display: inline-flex; align-items: center; gap: 10px; color: var(--ouro-400); }
.logo-mark { flex-shrink: 0; }
.logo span {
  font-family: var(--font-display);
  font-size: 19px; font-weight: 500;
  letter-spacing: .25em;          /* wordmark tem tracking LARGO */
  color: var(--text);
  background: none; -webkit-background-clip: initial; /* remove o clip de gradiente antigo */
}
```

Altura mínima do logo é **32px** em web (`DESIGN_SYSTEM.md` §5.4) — o SVG acima respeita isso.

### 7.3 Cards de evento

- `.card`: `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`.
- `.card:hover`: `translateY(-2px)` (não -4px), `border-color: rgba(199,154,74,.4)`, `box-shadow: var(--shadow-2)`.
- `.card .cover`: adicionar `border-radius: var(--radius-arch)` — **a forma de arco no topo do card é a assinatura visual do refactor**.
- Overlay da capa: trocar por `linear-gradient(to top, rgba(12,19,36,.9), transparent 60%)`.
- `.card-cat`: cor `var(--ouro-400)`.
- `.date-chip b`: Inter Bold; `.date-chip span`: `var(--ouro-400)`.
- `.avail .bar > span`: `background: var(--grad-energia)`.

### 7.4 Badges

```css
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: var(--radius-sm);
  font-family: var(--font-ui); font-size: 11px; font-weight: 600;
  letter-spacing: .08em; text-transform: uppercase;
}
.badge.green  { background: rgba(79,191,139,.14); color: var(--sucesso-on-dark); }
.badge.red    { background: rgba(232,112,95,.14); color: var(--erro-on-dark); }
.badge.yellow { background: rgba(217,179,122,.14); color: var(--aviso-on-dark); }
.badge.purple { background: rgba(168,123,216,.16); color: var(--violeta-300); }
.badge.gray   { background: var(--surface-2); color: var(--text-muted); }
```

> `.badge.purple` **precisa** usar `violeta-300 #A87BD8`, nunca `violeta-600`, que rende 2.26:1 sobre Noite.

### 7.5 Chips, navegação e formulários

- `.chip.active` / `.nav a.active`: trocar o fundo violeta translúcido por **filete inferior laranja de 2px** + texto `var(--text)`. Mais arquitetônico, menos "pílula de app".
- `.filters input:focus` etc.: borda `var(--ouro-400)` e `box-shadow: 0 0 0 3px rgba(217,179,122,.2)`.
- Ícone de busca embutido no `background` do input (linha 270): trocar o stroke `%239a90ad` por `%23A8B2C6`.

### 7.6 Ticket e QR

O ticket é o objeto central da marca (`DESIGN_SYSTEM.md` §8.6) e hoje é uma linha de lista comum.

```css
.ticket {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
/* filete ouro interno — assinatura do ticket Tessera */
.ticket::before {
  content: ""; position: absolute; inset: 8px;
  border: 1px solid rgba(199,154,74,.35);
  border-radius: calc(var(--radius-lg) - 4px);
  pointer-events: none;
}
.ticket:hover { border-color: rgba(199,154,74,.5); transform: translateY(-2px); }
.ticket.frozen { opacity: .5; }
```

O `.qr` (linhas 317–323) é um padrão falso de listras. Manter o placeholder, mas garantir **fundo Luz sólido** e moldura ouro — QR precisa de fundo claro:

```css
.qr { border: 8px solid var(--luz-500); border-radius: var(--radius-sm); box-shadow: var(--glow-ouro); }
```

### 7.7 Painéis, tabelas, stats, modais

- `.panel`, `.stat`: `--surface` + `--border` + `--radius-lg`.
- `.stat::before` (filete superior de 3px): `background: var(--grad-energia)`.
- `.stat .value`: Inter, `tabular-nums`.
- `th`: eyebrow em `var(--ouro-400)`.
- `.modal`: overlay `rgba(6,11,22,.78)`; `.modal .box` com `--radius-xl` e `--shadow-3`.
- `.note`: fundo `rgba(107,47,163,.10)`, borda `rgba(168,123,216,.3)`, `.note b` em `var(--violeta-300)`.
- `.split-bar`: `.s1` sucesso, `.s2` violeta-500, `.s3` ouro-500.
- `.result.ok`: borda/texto sucesso; `.result.fail`: borda/texto erro.
- `.scanner`: borda tracejada `var(--border-strong)`, fundo `var(--surface)`.

---

## 8. Fase 4 — Formas de marca

### Textura de mosaico

Fundo sutil para heroes, banners e estados vazios (`DESIGN_SYSTEM.md` §4.3). Quadrifólio em Ouro a baixa opacidade:

```css
.mosaic {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48' fill='none' stroke='%23C79A4A' stroke-opacity='.16' stroke-width='1'%3E%3Cpath d='M24 16a4 4 0 1 1 0 8 4 4 0 1 1 0-8Zm-4 4a4 4 0 1 1 8 0 4 4 0 1 1-8 0Z'/%3E%3C/svg%3E");
  background-size: 48px 48px;
}
```

Aplicar em `.hero::after` e `.banner::after` como camada extra. **Nunca atrás de texto corrido.**

### Divisor com quadrifólio

O Brand Book separa seções com um pequeno ornamento centralizado. Bom para `.section-head` e rodapé:

```css
.divider { display: flex; align-items: center; gap: 16px; color: var(--ouro-500); }
.divider::before, .divider::after {
  content: ""; flex: 1; height: 1px; background: currentColor; opacity: .3;
}
```

---

## 9. Fase 5 — HTML por arquivo

### 9.1 Renomeação global

17 ocorrências de "Shaar" em 8 arquivos. Substituir por "Tessera":

| Arquivo | Onde |
|---|---|
| `index.html` | `<title>`, logo do header, logo do rodapé, texto do `footer` |
| `evento.html`, `ingressos.html`, `mercado.html`, `organizador.html`, `admin.html`, `checkin.html` | `<title>` e logo do header |
| `styles.css` | comentário da linha 1 |

Títulos das páginas: padronizar como `Tessera — <Página>` (ex.: `Tessera — Meus Ingressos`).

Texto do rodapé em `index.html` (linha 244) descreve o produto pela mecânica. Reescrever na voz da marca:

> "Cada ingresso abre uma experiência. Cada experiência se torna parte da sua história."

### 9.2 Emojis → ícones SVG

**67 emojis** em 7 arquivos (44 só no `index.html`). Emoji não é ícone: renderiza diferente por SO, não aceita cor da paleta e quebra a linguagem clássica da marca.

Estratégia: adicionar um sprite SVG no topo de cada HTML e referenciar com `<use>`.

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <g id="i-portal" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <path d="M4 21V11a8 8 0 0 1 16 0v10"/><path d="M2 21h20"/>
  </g>
  <g id="i-ticket" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
    <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z"/>
  </g>
  <g id="i-quadrifolio" fill="none" stroke="currentColor" stroke-width="1.6">
    <path d="M12 7a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 1 1 0-5.2Z"/>
    <path d="M12 11.8a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 1 1 0-5.2Z"/>
    <path d="M9.4 9.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 1 1 0-5.2Z"/>
    <path d="M14.6 9.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 1 1 0-5.2Z"/>
  </g>
  <g id="i-coluna" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <path d="M6 6h12M7 6v12M12 6v12M17 6v12M5 18h14"/>
  </g>
  <g id="i-escudo" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
    <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z"/>
  </g>
  <g id="i-local" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
    <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>
  </g>
  <g id="i-calendario" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>
  </g>
</defs></svg>
```

```css
.ico { width: 1.25em; height: 1.25em; display: inline-block; vertical-align: -.2em; color: currentColor; }
```

Uso: `<svg class="ico"><use href="#i-local"/></svg>`

Mapa de tradução (o restante segue o mesmo critério — escolha o ícone da família Tessera mais próximo do **domínio**, não do desenho literal):

| Emoji atual | Onde aparece | Substituir por |
|---|---|---|
| 🎫 🎟️ | chips, hero-meta, categorias | `#i-ticket` |
| 📍 | local do evento nos cards | `#i-local` |
| 📅 | data nos heroes e banners | `#i-calendario` |
| 🔥 ✨ | "Top da semana", "Em destaque" | `#i-quadrifolio` |
| 🎸 🎪 🎭 🎤 ⚽ 💻 🌌 🎡 🎶 💡 🌊 | capas de card, chips de categoria | `#i-portal` (as capas ganham gradiente + mosaico; a categoria vira eyebrow textual) |
| 📷 | scanner do check-in | `#i-quadrifolio` dentro do arco |
| ✓ ✗ | resultados do check-in | `#i-escudo` (ok) / `#i-escudo` com cor de erro |
| ⏳ | filas de aprovação no admin | `#i-coluna` |
| 🥇🥈🥉 | `.hero-rank` do carrossel | texto `#1`, `#2`, `#3` em Playfair sobre pílula Ouro |

> Nas capas de card (`.cover-emoji`, 52px), o emoji hoje é o elemento visual dominante. Substituir por **quadrifólio grande em Ouro a ~20% de opacidade** sobre o gradiente — vira textura de marca em vez de figurinha. A categoria já é comunicada pelo eyebrow `.card-cat`.

### 9.3 Microcópia

O preview fala como plataforma genérica. Ajustar os pontos de maior visibilidade para a voz da marca (`DESIGN_SYSTEM.md` §1) — próxima, otimista, inspiradora:

| Onde | Hoje | Sugestão |
|---|---|---|
| `index.html` — seção do carrossel | "🔥 Top da semana" | "Em destaque esta semana" |
| `ingressos.html` — `<h1>` | "Meus Ingressos" | "Minha coleção" — é o vocabulário central da marca (Ingresso → Portal → Tessera → **Coleção**) |
| `index.html` — rodapé | descrição mecânica | "Cada ingresso abre uma experiência." |
| Estados vazios (se houver) | — | Padrão da §8.7 do design system |

Não reescreva tudo: nomes de eventos, preços, locais e dados falsos ficam como estão.

---

## 10. Fase 6 — Acessibilidade

Adicionar ao final de `styles.css`:

```css
:focus-visible {
  outline: 2px solid var(--ouro-400);
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

Além disso:

- Os `<button class="carousel-arrow">` já têm `aria-label` — manter.
- Todo `<svg class="ico">` decorativo recebe `aria-hidden="true"`; se o ícone for o único conteúdo de um controle, adicionar `aria-label` no controle.
- `.dots a` (paginação do carrossel) precisa de `aria-label` (ex.: "Ir para destaque 2").
- Badges de status nunca ficam só na cor — o texto já existe em todos; **preserve-o** ao trocar por ícones.

---

## 11. Critérios de aceite

Verificações objetivas ao final:

**Higiene**
- [ ] `grep -ri "shaar" platform/preview/` retorna **0** resultados.
- [ ] Busca por `#a855f7`, `#d63af0`, `#ff2d78`, `#24e0d4`, `#4f7bff`, `#ffca45`, `#0a0710` em `styles.css` retorna **0** resultados.
- [ ] Nenhum emoji resta nos 7 arquivos HTML.

**Marca**
- [ ] `Playfair Display` aplicado a todos os títulos; `Inter` a toda a interface funcional.
- [ ] Nenhum `letter-spacing` negativo e nenhum `font-weight: 800/900` em título.
- [ ] Logo com símbolo SVG (arco + quadrifólio) e wordmark com `letter-spacing: .25em`, ≥32px de altura, no header e no rodapé das 7 páginas.
- [ ] Capas de card usam `--radius-arch`.
- [ ] Só os três gradientes de marca aparecem no CSS.

**Acessibilidade — verificar, não presumir**
- [ ] **Nenhum botão primário tem texto branco.** `.btn` usa `color: var(--on-action)` = `#0C1324`.
- [ ] `.badge.purple` usa `violeta-300 #A87BD8`, não `violeta-600`.
- [ ] `:focus-visible` visível em links, botões, inputs e selects nas 7 páginas (navegue por Tab).
- [ ] `prefers-reduced-motion` respeitado.

**Funcional**
- [ ] As 7 páginas abrem por `file://` sem erro de console.
- [ ] Carrossel do `index.html` continua funcionando (o script lê o gap do token `--carousel-gap`; não volte a codificar o número).
- [ ] Modais via `:target` continuam abrindo em `evento.html`, `ingressos.html`, `mercado.html`, `organizador.html`, `admin.html`.
- [ ] Navegação entre as 7 telas intacta.

---

## 12. Armadilhas

1. **Texto branco em botão laranja.** O reflexo é escrever `color: #fff`. Reprova em contraste (2.69:1). É Noite.
2. **`--accent` mudou de papel.** Antes era violeta decorativo espalhado por hovers e bordas; agora `--action` é laranja e significa *ação*. Não faça substituição cega de `var(--accent)` → `var(--action)`: nos hovers de borda e nos estados ativos o correto costuma ser **Ouro**, não laranja. Revise caso a caso — são **8 usos** de `var(--accent)`.
3. **Trocar os tokens não basta — há cor neon codificada diretamente.** `styles.css` tem **10 ocorrências de `rgba(168, 85, 247, …)`** (violeta neon) e **13 linhas com hex neon literal** (`#a855f7`, `#d63af0`, `#ff2d78`, `#24e0d4`, `#4f7bff`, `#ffca45`, `#0a0710`, `#14e0c8`) fora do bloco `:root`. Elas sobrevivem a qualquer reescrita de variáveis. Faça uma varredura literal no arquivo inteiro ao final.
4. **Violeta como texto sobre escuro.** Só `violeta-300`. `violeta-600` é preenchimento.
5. ~~**O gap do carrossel está codificado no JS.**~~ *Resolvido na execução:* virou o token `--carousel-gap`, lido pelo script com `getComputedStyle`. Mudar o gap no CSS agora basta.
6. **Excesso de laranja.** A proporção é 15%. Laranja é ação, não decoração — se cada card tiver botão laranja visível, a tela vira um semáforo. Nos grids de card, prefira `.btn.secondary` e reserve o laranja para o CTA da página.
7. **Playfair em texto pequeno.** Nunca abaixo de ~20px: labels, badges, tabelas, botões e navegação são Inter.
8. **Não "conserte" o hex de Violeta.** É `#6B2FA3`. O Brand Book imprime `#0B2FA3` por erro de digitação (`DESIGN_SYSTEM.md` §10.1). Se alguém trocar por `#0B2FA3`, a interface fica azul.

---

## 13. Ordem sugerida de commits

1. `feat(preview): adiciona fontes e tokens do design system Tessera`
2. `refactor(preview): migra styles.css para os tokens de marca`
3. `refactor(preview): aplica tipografia Playfair + Inter`
4. `refactor(preview): componentes (botões, cards, badges, ticket) no design system`
5. `feat(preview): substitui emojis por sistema de ícones SVG`
6. `refactor(preview): renomeia Shaar para Tessera e ajusta microcópia`
7. `fix(preview): foco visível e prefers-reduced-motion`

Cada commit deve deixar o preview navegável.
