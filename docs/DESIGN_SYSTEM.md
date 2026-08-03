# Tessera — Design System v1.0

Sistema de design derivado do **Brand Book Tessera v1.0** (`docs/Tessera_Brand_Study_2.pdf`, 46 páginas).

Este documento é a fonte única de verdade para cor, tipografia, forma, espaçamento e componentes em todas as superfícies digitais da Tessera (webapp, app móvel, painéis de organizador e admin).

> **Como ler este documento**
> Cada seção marca a origem da informação:
> - 📕 **Brand Book** — extraído diretamente do PDF. Não altere sem aprovação de marca.
> - 🔧 **Derivado** — decisão de implementação criada para web/produto, coerente com o Brand Book mas **não** especificada nele. Pode evoluir com o produto.
>
> Todos os índices de contraste citados foram medidos (WCAG 2.1, fórmula de luminância relativa), não estimados.

---

## Índice

1. [Fundação da marca](#1-fundação-da-marca)
2. [Cor](#2-cor)
3. [Tipografia](#3-tipografia)
4. [Forma, símbolo e ícones](#4-forma-símbolo-e-ícones)
5. [Logo](#5-logo)
6. [Espaçamento, grid e elevação](#6-espaçamento-grid-e-elevação)
7. [Movimento](#7-movimento)
8. [Componentes](#8-componentes)
9. [Tokens (CSS)](#9-tokens-css)
10. [Divergências encontradas no Brand Book](#10-divergências-encontradas-no-brand-book)

---

## 1. Fundação da marca

📕 *Brand Book, páginas 1–8*

### A frase que resume tudo

> **"Abrimos portas para experiências que ficam na memória."**

### Missão

Conectar pessoas a experiências incríveis com simplicidade, segurança e emoção. Transformar cada ingresso em uma lembrança que permanece.

### Visão

Ser a plataforma de experiências mais amada do mundo, onde cada pessoa constrói sua coleção de momentos e histórias que a definem.

### Essência

**Tecnologia que desaparece. Emoção que permanece.**

"Tessera" vem do latim e significa *peça* ou *ficha de admissão* — na Roma Antiga, as tesserae garantiam acesso a lugares e experiências. A marca usa tecnologia para transformar isso em algo maior: memórias que permanecem.

### O conceito em quatro tempos

| Etapa | Significado |
|---|---|
| **Ingresso** | O acesso a um momento |
| **Portal** | A experiência que transforma |
| **Tessera** | A peça que fica, única e inesquecível |
| **Coleção** | Seu mosaico de histórias vividas |

### A jornada Tessera

Toda decisão de produto deve saber em qual destas três fases está operando:

| Fase | Estado emocional | Papel do produto |
|---|---|---|
| **Antes** | Expectativa | A experiência começa muito antes da abertura dos portões |
| **Durante** | Presença | O acesso desaparece; o momento ganha espaço |
| **Depois** | Memória | O ingresso deixa de ser comprovante e vira parte da coleção |

### Valores

- **Confiança** — segurança e transparência em cada etapa
- **Experiência** — cada detalhe importa; o comum vira extraordinário
- **Pertencimento** — conectamos pessoas a eventos e comunidades
- **Memória** — momentos que viram lembranças duradouras
- **Legado** — coleções que constroem histórias para a vida toda

### Personalidade

Inteligente · Divertida · Acolhedora · Moderna · Calorosa

**Somos modernos sem perder nossa alma clássica.**

### Tom de voz

Próximo, otimista, inspirador e seguro. Conversamos com naturalidade e transparência.

| Somos | Não somos |
|---|---|
| Próximos | Elitistas |
| Inspiradores | Complicados |
| Transparentes | Frios ou distantes |
| Entusiastas | Genéricos |
| Inclusivos | Automatizados |
| Confiáveis | Indiferentes |

**Falamos como:** amigos que recomendam · pessoas que acreditam · quem resolve problemas · quem celebra conquistas.

### Princípios de experiência

📕 *Brand Book, página 17*

1. **Seguro** — protegemos pessoas, dados e experiências com tecnologia confiável e processos claros
2. **Simples** — facilitamos escolhas e jornadas intuitivas com clareza e praticidade
3. **Emocionante** — criamos momentos que surpreendem, encantam e ficam na memória
4. **Humano** — tratamos cada pessoa com empatia, respeito e proximidade
5. **Contínuo** — evoluímos sempre, ouvindo, aprendendo e melhorando cada detalhe

> **Menos atrito. Mais significado.**

---

## 2. Cor

### 2.1 Paleta principal

📕 *Brand Book, página 12 — "Color Story"*

| Token | Nome | Hex | Significado |
|---|---|---|---|
| `noite` | **Noite** | `#0C1324` | Profundidade, confiança e sofisticação. Base que dá estrutura e elegância. |
| `violeta` | **Violeta** | `#6B2FA3` | Criatividade, misticismo e transformação. Traz energia e personalidade. |
| `laranja` | **Laranja** | `#FF6A00` | Energia, entusiasmo e momentos que acendem. Cor da ação e da vida. |
| `ouro` | **Ouro** | `#C79A4A` | Valor, legado e refinamento atemporal. Representa o clássico e o precioso. |
| `pedra` | **Pedra** | `#E6D7BE` | Neutralidade, equilíbrio e base sólida. A calma que sustenta a experiência. |
| `luz` | **Luz** | `#FAF7F2` | Clareza, simplicidade e espaço para o essencial. |

> ⚠️ O Brand Book imprime o hex de Violeta como `#0B2FA3`. Isso é um **erro de digitação** — `#0B2FA3` é azul, e a amostra impressa é inequivocamente roxa. A amostragem de pixel da página renderizada a 300 DPI retorna `#663193`, consistente com `#6B2FA3` (o "6" virou "0"). **Use `#6B2FA3`.** Ver [seção 10](#10-divergências-encontradas-no-brand-book).

### 2.2 Proporção de uso

📕 *Brand Book, página 12 — "Uso Equilibrado", proporção sugerida para aplicações digitais e impressas*

| Cor | Proporção |
|---|---|
| Noite | **40%** |
| Violeta | **20%** |
| Laranja | **15%** |
| Ouro | **10%** |
| Pedra | **10%** |
| Luz | **5%** |

Leitura prática: **Noite domina** (fundos, superfícies, estrutura). Violeta é o segundo volume — não é um detalhe, é atmosfera (gradientes, estados ativos, fundos de destaque). Laranja é ação e nunca deve virar fundo de área grande. Ouro é premium/legado. Pedra e Luz são respiro.

> Nota: a capa do Brand Book (página 1) sugere uma proporção diferente (70% Ivory / 20% Midnight Navy / 5% Laranja / 5% Violeta). Adotamos a da página 12 por ser a especificação dedicada de cor. Ver [seção 10](#10-divergências-encontradas-no-brand-book).

### 2.3 Rampas 🔧

O Brand Book define seis cores sólidas. Produto precisa de variações para hierarquia, estados e contraste. Estas rampas são derivadas, mantendo o matiz das cores originais.

**Noite** — estrutura e superfícies
| Passo | Hex | Uso |
|---|---|---|
| `noite-900` | `#060B16` | Fundo mais profundo, overlays |
| `noite-800` | `#0C1324` | **Base.** Fundo da aplicação |
| `noite-700` | `#131D33` | Superfície elevada (cards) |
| `noite-600` | `#1B2743` | Superfície secundária (inputs, hover) |
| `noite-500` | `#243254` | Bordas e divisores |
| `noite-400` | `#35456B` | Bordas em destaque |

**Violeta** — atmosfera e criatividade
| Passo | Hex | Uso |
|---|---|---|
| `violeta-700` | `#4E2178` | Fundos profundos, gradiente |
| `violeta-600` | `#6B2FA3` | **Base.** Preenchimentos, gradientes |
| `violeta-500` | `#8248BE` | Hover de preenchimento |
| `violeta-400` | `#9161C9` | Bordas ativas |
| `violeta-300` | `#A87BD8` | **Texto violeta sobre fundo escuro** |
| `violeta-200` | `#C6A8E6` | Texto de baixa ênfase sobre violeta |

**Laranja** — ação e energia
| Passo | Hex | Uso |
|---|---|---|
| `laranja-700` | `#A63F00` | **Texto laranja sobre fundo claro** |
| `laranja-600` | `#C24E00` | Hover em tema claro |
| `laranja-500` | `#FF6A00` | **Base.** Preenchimento de botão primário |
| `laranja-400` | `#FF8C3F` | **Texto laranja sobre fundo escuro**; hover |
| `laranja-300` | `#FFB07A` | Detalhes, ícones sobre escuro |

**Ouro** — valor e legado
| Passo | Hex | Uso |
|---|---|---|
| `ouro-700` | `#7A5A22` | **Texto ouro sobre fundo claro** |
| `ouro-600` | `#A07A35` | Hover em tema claro |
| `ouro-500` | `#C79A4A` | **Base.** Filetes, molduras, selos premium |
| `ouro-400` | `#D9B37A` | **Texto ouro sobre fundo escuro** |
| `ouro-300` | `#E8CEA3` | Detalhes finos, linhas decorativas |

**Pedra / Luz** — neutros
| Passo | Hex | Uso |
|---|---|---|
| `pedra-700` | `#A8926C` | Texto auxiliar em tema claro |
| `pedra-600` | `#CBB794` | Bordas em tema claro |
| `pedra-500` | `#E6D7BE` | **Base.** Superfície bege, divisores |
| `pedra-400` | `#EFE5D5` | Superfície suave |
| `luz-600` | `#F0EAE0` | Superfície alternada em tema claro |
| `luz-500` | `#FAF7F2` | **Base.** Fundo do tema claro; texto sobre escuro |

### 2.4 Cores de estado 🔧

O Brand Book **não** define cores de sucesso/erro/aviso. Estas foram derivadas para harmonizar com a paleta — evitando verdes e vermelhos saturados de "dashboard genérico", que brigam com Laranja e Ouro.

| Estado | Base | Sobre fundo escuro | Sobre fundo claro |
|---|---|---|---|
| **Sucesso** | `#2F8F63` | `#4FBF8B` | `#1F6B49` |
| **Erro** | `#C4392A` | `#E8705F` | `#A32B1C` |
| **Aviso** | `#C79A4A` (Ouro) | `#D9B37A` | `#7A5A22` |
| **Informação** | `#6B2FA3` (Violeta) | `#A87BD8` | `#6B2FA3` |

Aviso e Informação reutilizam Ouro e Violeta de propósito: reduz o número de matizes na interface e mantém a paleta coesa.

### 2.5 Gradientes

📕 *Brand Book, página 12 — "Gradientes de apoio"*

| Nome | Definição | Uso |
|---|---|---|
| **Profundidade** | Noite → Violeta | Fundos de hero, atmosfera, cabeçalhos |
| **Energia** | Violeta → Laranja | Destaques, CTAs de alta ênfase, badges de evento |
| **Legado** | Laranja → Ouro | Selos premium, conquistas, coleção |

```css
--grad-profundidade: linear-gradient(135deg, #0C1324 0%, #6B2FA3 100%);
--grad-energia:      linear-gradient(135deg, #6B2FA3 0%, #FF6A00 100%);
--grad-legado:       linear-gradient(135deg, #FF6A00 0%, #C79A4A 100%);
```

Os três gradientes descrevem a jornada da marca: **Profundidade** (antes) → **Energia** (durante) → **Legado** (depois).

### 2.6 Acessibilidade — pares verificados

Todos os valores abaixo foram **medidos**. `AA` exige 4.5:1 para texto normal; `AA-lg` (3:1) vale apenas para texto ≥ 24px ou ≥ 19px em negrito.

**Sobre Noite `#0C1324`:**

| Cor de frente | Contraste | Nível |
|---|---|---|
| Luz `#FAF7F2` | 17.33 | AAA |
| Pedra `#E6D7BE` | 13.07 | AAA |
| Ouro-400 `#D9B37A` | 9.42 | AAA |
| Muted `#A8B2C6` | 8.68 | AAA |
| Sucesso-400 `#4FBF8B` | 8.07 | AAA |
| Laranja-400 `#FF8C3F` | 8.00 | AAA |
| Ouro-500 `#C79A4A` | 7.18 | AAA |
| Laranja-500 `#FF6A00` | 6.45 | AA |
| Erro-400 `#E8705F` | 6.10 | AA |
| Violeta-300 `#A87BD8` | 5.72 | AA |
| **Violeta-600 `#6B2FA3`** | **2.26** | **REPROVADO** |

**Sobre Luz `#FAF7F2`:**

| Cor de frente | Contraste | Nível |
|---|---|---|
| Noite `#0C1324` | 17.33 | AAA |
| Violeta-600 `#6B2FA3` | 7.67 | AAA |
| Erro-700 `#A32B1C` | 6.73 | AA |
| Sucesso-700 `#1F6B49` | 6.03 | AA |
| Ouro-700 `#7A5A22` | 5.93 | AA |
| Laranja-700 `#A63F00` | 5.90 | AA |
| Muted `#5A6478` | 5.57 | AA |
| **Laranja-500 `#FF6A00`** | **2.69** | **REPROVADO** |
| **Ouro-500 `#C79A4A`** | **2.41** | **REPROVADO** |

**Sobre preenchimentos:**

| Combinação | Contraste | Nível |
|---|---|---|
| Noite sobre Laranja-500 | 6.45 | AA |
| Noite sobre Ouro-500 | 7.18 | AAA |
| Noite sobre Pedra-500 | 13.07 | AAA |
| Luz sobre Violeta-600 | 7.67 | AAA |
| **Luz sobre Laranja-500** | **2.69** | **REPROVADO** |

### 2.7 Regras de cor não negociáveis

1. **Botão laranja leva texto Noite, nunca branco.** Branco sobre `#FF6A00` dá 2.69:1 — reprova. Noite sobre laranja dá 6.45:1. Esta é a regra mais fácil de violar por instinto e a mais visível quando errada.
2. **Violeta-600 nunca é cor de texto sobre fundo escuro** (2.26:1). Sobre escuro, use `violeta-300`. Violeta-600 é excelente como *preenchimento* com texto Luz por cima (7.67:1).
3. **Laranja e Ouro puros não são cor de texto sobre fundo claro.** Use `laranja-700` / `ouro-700`.
4. **Laranja é ação, não decoração.** Se mais de ~15% da tela é laranja, algo está errado na hierarquia.
5. **Um só CTA primário por bloco de decisão.** Laranja só aparece na ação principal; as demais são secundárias ou fantasma.
6. **Cor nunca é o único portador de significado.** Todo estado (esgotado, pausado, confirmado) precisa de texto ou ícone junto do matiz.

---

## 3. Tipografia

📕 *Brand Book, página 13 — "Tipografia"*

### 3.1 Famílias

| Papel | Família | Descrição |
|---|---|---|
| **Principal** | **Playfair Display** | Fonte de destaque. Elegante, expressiva e inspirada na escrita clássica. Comunica tradição, cultura e permanência. |
| **Apoio** | **Inter** | Fonte de apoio. Moderna, legível e neutra para textos, interfaces e informações. Garante legibilidade, funcionalidade e escala. |

> A combinação é intencional: **Playfair carrega a alma clássica; Inter entrega a clareza contemporânea.** "Do monumental ao essencial. Do clássico ao cotidiano."

Ambas são open source e estão no Google Fonts.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 3.2 Hierarquia

📕 *Brand Book, página 13 — "Hierarquia tipográfica"*

| Nível | Uso | Família e peso | Tamanho | Entrelinha |
|---|---|---|---|---|
| **H1** | Títulos grandes | Playfair Display **Bold** | 72–96px | 1.05 🔧 |
| **H2** | Subtítulos | Playfair Display **Semibold** | 36–48px | 1.15 🔧 |
| **H3** | Destaques | Playfair Display **Regular** | 24–32px | 1.25 🔧 |
| **Body** | Corpo de texto | Inter Regular | 16–18px | **1.6** |
| **Small** | Textos auxiliares | Inter Regular | 12–14px | **1.4** |

As entrelinhas de H1–H3 não constam no Brand Book; foram derivadas para display serif (títulos serifados grandes precisam de entrelinha apertada para não parecerem soltos).

### 3.3 Escala responsiva 🔧

Os tamanhos do Brand Book são para desktop/impresso. Em produto, use `clamp()` para não quebrar em telas pequenas:

```css
--fs-display: clamp(2.5rem, 6vw + 1rem, 6rem);    /* 40 → 96px  · H1 */
--fs-h1:      clamp(2rem, 4vw + .5rem, 4.5rem);   /* 32 → 72px  */
--fs-h2:      clamp(1.75rem, 2.5vw + .5rem, 3rem);/* 28 → 48px  · H2 */
--fs-h3:      clamp(1.375rem, 1.5vw + .5rem, 2rem);/* 22 → 32px · H3 */
--fs-body-lg: 1.125rem;  /* 18px */
--fs-body:    1rem;      /* 16px */
--fs-small:   .875rem;   /* 14px */
--fs-micro:   .75rem;    /* 12px */
```

### 3.4 Regras de uso

- **Playfair só em títulos e frases-manifesto.** Nunca em corpo de texto, label de formulário, tabela, botão ou navegação — a serifa de alto contraste perde legibilidade abaixo de ~20px.
- **Inter para toda a interface funcional:** navegação, botões, formulários, tabelas, badges, metadados, preços.
- **Eyebrows / rótulos de seção** (o padrão "PALETA PRINCIPAL", "NOSSOS PILARES" do Brand Book): Inter Semibold, 11–12px, `letter-spacing: .12em`, caixa alta, em Ouro ou Laranja.
- **Números de preço** usam Inter com `font-variant-numeric: tabular-nums` para alinhar em listas.
- **Ênfase colorida dentro de títulos** é uma assinatura da marca: o Brand Book pinta consistentemente uma parte do título em Laranja ou Violeta ("Cada ingresso abre uma **experiência**"). Use com moderação — no máximo um trecho colorido por título.
- **Nunca** use itálico falso, condensado falso ou `text-transform: uppercase` em Playfair.

---

## 4. Forma, símbolo e ícones

📕 *Brand Book, páginas 18, 19, 26*

### 4.1 Vocabulário de formas

Cinco formas centrais, todas de origem arquitetônica:

| Forma | Significado |
|---|---|
| **Arco / Portal** | Passagem, acolhimento e conexão entre momentos |
| **Ticket** | Acesso, experiência e valor de cada momento |
| **Quadrifólio** | Inspirado na arquitetura gótica; harmonia, equilíbrio e proteção |
| **Pedra angular** | Propósito que dá sentido a tudo; união e essência |
| **Coluna** | Sustentação, confiança e solidez |

Formas de apoio: **círculo** (unidade, continuidade), **onda** (movimento, fluidez), **triângulo** (direção, equilíbrio), **linha** (conexão, simplicidade).

### 4.2 Sistema de ícones

- Estilo **linear (outline)**, traço uniforme, cantos suaves, geometria simples e simétrica.
- Derivam do símbolo principal — arco, ticket, quadrifólio, pedra angular, coluna.
- Variações permitidas: contorno, preenchido, dentro de círculo, dentro de quadrado arredondado.
- Princípio 📕: **"Um ícone é bem sucedido quando comunica sem explicar."**

Mapeamento recomendado por domínio:

| Domínio | Ícone base |
|---|---|
| Navegação (menus, barras, caminhos) | **Portal / Arco** |
| Ingressos (compra, detalhe, histórico) | **Ticket** |
| Experiências (categorias, eventos, recomendações) | **Quadrifólio** |
| Confiança (segurança, suporte, informações) | **Pedra angular / Escudo** |
| Comunidade (perfis, grupos, conexões) | **Coluna / Pessoas** |

🔧 Para implementação: traço de **1.5px** em ícones de 20–24px, `stroke-linecap: round`, `stroke-linejoin: round`, sem preenchimento por padrão.

> **Emoji não é ícone.** Emoji quebra a linguagem clássica da marca, renderiza diferente em cada sistema operacional e não aceita cor da paleta. Substituir por SVG do sistema.

### 4.3 Padrões e mosaicos

📕 *Brand Book, página 19*

A marca tem cinco padrões modulares — quadrifólio, arcos, círculos, tickets, ondas — usados como textura de fundo em baixa opacidade. Combinados formam mosaicos ("Mosaico Clássico", "Estrela", "Conexão", "Tessera", "Fluido").

Uso em produto: como textura sutil em heroes, cabeçalhos e estados vazios, em **Ouro a 4–8% de opacidade sobre Noite**. Nunca atrás de texto corrido.

O mosaico é literalmente a metáfora da coleção: cada Tessera é uma peça do mosaico da vida do usuário. A tela de coleção do usuário é o lugar mais forte para usá-lo.

---

## 5. Logo

📕 *Brand Book, páginas 19–28*

### 5.1 As três camadas da marca

| Camada | O que é | Uso |
|---|---|---|
| **01 · Símbolo essencial** | O quadrifólio / portal isolado | Reconhecível em qualquer tamanho e contexto |
| **02 · Logotipo oficial** | Símbolo + wordmark TESSERA | Comunicações institucionais e comerciais |
| **03 · Hero mark ilustrativa** | Representação completa do universo | Campanhas, momentos especiais, storytelling |

### 5.2 Construção

O símbolo combina **arco superior** (círculos perfeitos, abertura e acolhimento), **colunas** (proporção clássica 1:7), **ticket** (retângulo com entalhes), **quadrifólio** (centro do significado) e **bases** (fundação sólida).

Proporções principais: largura total **1.618X** (áurea), altura total **2X**, largura do arco **1X**, diâmetro do quadrifólio **0.382X**, espessura do traço **0.08X**.

Wordmark: serifa clássica com **letter-spacing largo** (aproximadamente `.25em`), caixa alta. Tagline opcional: *EXPERIÊNCIAS QUE PERMANECEM*.

### 5.3 Versões aprovadas

1. **Positiva** — para fundos claros e neutros
2. **Negativa** — para fundos escuros ou coloridos
3. **Monocromática** — aplicações de uma cor só
4. **Dourada** — aplicações premium ou comemorativas
5. **Horizontal com nome** — assinaturas, cabeçalhos, rodapés
6. **Horizontal com tagline** — prioritária quando o espaço horizontal permitir
7. **Vertical** — espaços estreitos
8. **Símbolo isolado** — ícones de app, favicons, estampas, marca d'água
9. **Wordmark isolado** — restrito a casos onde o símbolo já esteja presente
10. **Versão branca** — sobre imagens com boas áreas de respiro e contraste

### 5.4 Tamanhos mínimos

📕 *Brand Book, página 27*

| Aplicação | Versão | Mínimo |
|---|---|---|
| Digital (sites e webapps) | Símbolo com wordmark | **32px** |
| App (aplicativos móveis) | Símbolo com wordmark | **24px** |
| Favicon (navegadores) | Símbolo isolado | **16px** |
| Impressão (ingressos, etiquetas) | Símbolo com wordmark | **8mm** |
| Sinalização (outdoors, banners) | Símbolo com wordmark | **40mm** |

> 📕 **Princípio:** a marca deve ser sempre legível, mesmo nos menores formatos. Quando necessário, use apenas o símbolo como versão mínima.

### 5.5 Proibições

📕 Não altere proporções, espessuras ou relações entre os elementos. Utilize apenas as versões aprovadas. Não recolorir fora da paleta, não aplicar sombra, contorno, distorção, rotação ou gradiente sobre o logo.

---

## 6. Espaçamento, grid e elevação

🔧 *Toda esta seção é derivada. O Brand Book define proporção e ritmo conceitualmente ("Proporção: tudo é pensado em equilíbrio"), mas não especifica valores para produto.*

### 6.1 Escala de espaçamento

Base de **4px**, com progressão que privilegia respiro — a marca valoriza "espaço para o essencial".

```
2xs  4px  ·  xs  8px  ·  sm 12px  ·  md 16px  ·  lg 24px
xl  32px  ·  2xl 48px  ·  3xl 64px  ·  4xl 96px  ·  5xl 128px
```

Separação entre seções de página: `3xl` (64px) em desktop, `2xl` (48px) em mobile.

### 6.2 Grid e larguras

| Contexto | Largura máxima |
|---|---|
| Conteúdo de leitura (texto corrido) | 68ch |
| Container padrão de aplicação | 1200px |
| Container largo (grids de card, tabelas) | 1400px |
| Padding lateral | 16px (mobile) / 32px (≥768px) / 48px (≥1280px) |

Grid de 12 colunas, gutter de 24px.

### 6.3 Raio de borda

A marca é **arquitetônica, não "app-bolha"**. Arcos são curvos; ticket e pedra são retos. Raios devem ser contidos.

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | 4px | Badges, chips pequenos |
| `radius-md` | 8px | Inputs, botões, elementos de formulário |
| `radius-lg` | 12px | Cards, painéis |
| `radius-xl` | 20px | Heroes, modais, superfícies grandes |
| `radius-arch` | `9999px 9999px 12px 12px` | **Forma de arco** — assinatura da marca |
| `radius-full` | 9999px | Avatares, indicadores circulares |

`radius-arch` é o detalhe que torna a interface reconhecivelmente Tessera. Use em capas de card de evento, modais de destaque e no topo de ilustrações — não em tudo.

### 6.4 Elevação

Em fundo Noite, sombra preta rende pouco. A elevação vem de **luminosidade da superfície + borda**, com sombra como reforço.

| Nível | Superfície | Borda | Sombra |
|---|---|---|---|
| 0 — base | `noite-800` | — | — |
| 1 — card | `noite-700` | `noite-500` | `0 1px 2px rgba(0,0,0,.4)` |
| 2 — elevado / hover | `noite-600` | `noite-400` | `0 8px 24px -8px rgba(0,0,0,.6)` |
| 3 — modal / popover | `noite-600` | `noite-400` | `0 24px 64px -16px rgba(0,0,0,.75)` |

**Brilho de marca** (para elementos premium, em vez de sombra colorida genérica):
```css
--glow-ouro:    0 0 0 1px rgba(199,154,74,.35), 0 8px 32px -12px rgba(199,154,74,.45);
--glow-violeta: 0 0 0 1px rgba(107,47,163,.40), 0 8px 32px -12px rgba(107,47,163,.55);
```

### 6.5 Foco

Acessibilidade não é opcional. Anel de foco visível e consistente em tudo que é focável:

```css
:focus-visible {
  outline: 2px solid var(--ouro-400);
  outline-offset: 2px;
  border-radius: inherit;
}
```

Ouro-400 rende 9.42:1 sobre Noite — visível sem competir com Laranja (que é ação).

---

## 7. Movimento

📕 *Brand Book, página 16 — "Motion & Digital Experience"*

> "A Tessera ganha vida através do movimento sutil e intencional, que guia, revela e transforma. Cada interação é clara, fluida e prazerosa."
>
> **Transições suaves. Entradas memoráveis.**

### Os quatro momentos de movimento

| Momento | Comportamento |
|---|---|
| **Entrada** | Elementos que surgem com elegância e propósito, preparando o palco para a experiência |
| **Transição** | Movimentos fluidos que conectam momentos e mantêm o ritmo da jornada |
| **Microinterações** | Detalhes que respondem ao toque e ao olhar, trazendo prazer e personalidade |
| **Feedback** | Respostas visuais claras e positivas que transmitem confiança |

### Tokens 🔧

```css
--ease-out:   cubic-bezier(.16, 1, .3, 1);      /* entradas, revelações */
--ease-in-out:cubic-bezier(.65, 0, .35, 1);     /* transições de estado */
--dur-fast:   150ms;   /* hover, foco, toque */
--dur-base:   250ms;   /* mudança de estado, expansão */
--dur-slow:   400ms;   /* entrada de página, revelação de conteúdo */
--dur-hero:   700ms;   /* momentos-chave: confirmação de ingresso, entrada em coleção */
```

### Regras

- Movimento **entra pelo escuro e revela pela luz** — opacidade + `translateY(8px)` é a entrada padrão.
- Hover de card: `translateY(-2px)` e aumento de borda. Nunca escala agressiva ou rotação.
- Momentos de confirmação (check-in aprovado, compra concluída) merecem `--dur-hero` e o gradiente **Legado** — são o "depois" da jornada.
- **Respeite `prefers-reduced-motion`.** Sob essa preferência, mantenha só mudanças de opacidade e corte transformações.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 8. Componentes

🔧 *Especificações derivadas, aplicando as regras das seções 2–7.*

### 8.1 Botões

| Variante | Fundo | Texto | Borda | Uso |
|---|---|---|---|---|
| **Primário** | `laranja-500` | **`noite-800`** | — | Ação principal. Um por bloco de decisão. |
| **Secundário** | transparente | `luz-500` | `noite-400` | Ações de apoio |
| **Fantasma** | transparente | `muted` | — | Ações terciárias, links de navegação |
| **Premium** | `grad-legado` | `noite-800` | — | Upgrade, coleção, conquista |
| **Destrutivo** | transparente | `erro-400` | `erro-400` | Cancelar, remover |

Altura 44px (`sm`: 36px), padding horizontal 24px, `radius-md`, Inter Semibold 15px.
Hover: primário vai para `laranja-400`; secundário ganha `background: rgba(250,247,242,.06)`.
Estado `disabled`: `opacity: .45` e `cursor: not-allowed`.

> Repetindo porque é o erro mais comum: **texto de botão primário é Noite, não branco.**

### 8.2 Cards de evento

Estrutura: capa (com `radius-arch` no topo) → conteúdo → rodapé de preço e ação.

- Superfície `noite-700`, borda `noite-500`, `radius-lg`.
- Capa com gradiente da paleta ou imagem, com overlay `linear-gradient(to top, rgba(12,19,36,.9), transparent 60%)` para garantir contraste de qualquer texto sobreposto.
- Chip de data no canto superior esquerdo: fundo `noite-900` a 82%, número em Inter Bold, mês em Ouro-400 micro caixa-alta.
- Categoria: eyebrow em Ouro-400.
- Título: **Playfair Display Regular 20–22px** — é onde a marca aparece no card.
- Metadados e disponibilidade: Inter, `muted`.
- Hover: `translateY(-2px)`, borda vai para `ouro-500` a 40%.

### 8.3 Badges de status

Fundo com 12–16% de opacidade da cor de estado, texto na variante `-400`, `radius-sm`, Inter Semibold 11px, `letter-spacing: .08em`, caixa alta. **Sempre acompanhados de rótulo textual** — nunca só cor.

| Status | Cor |
|---|---|
| Vendas abertas / Confirmado | Sucesso |
| Esgotado / Negado | Erro |
| Pausado / Pendente | Aviso (Ouro) |
| Revenda / Coleção | Informação (Violeta) |

### 8.4 Formulários

- Fundo `noite-600`, borda `noite-500`, `radius-md`, altura 44px, texto Inter 15px.
- Label acima do campo: Inter Medium 13px, `muted`.
- Foco: borda `ouro-400` + anel de foco (seção 6.5).
- Erro: borda `erro-400` + mensagem em `erro-400` com ícone, abaixo do campo.
- Placeholder nunca substitui label.

### 8.5 Navegação

- Barra superior: `noite-900` com `backdrop-filter: blur(12px)`, borda inferior `noite-500`.
- Logo à esquerda, versão horizontal, altura mínima 32px (seção 5.4).
- Item ativo: texto `luz-500` com filete inferior de 2px em `laranja-500`.
- Item inativo: `muted`; hover leva a `luz-500`.

### 8.6 O ticket

O ingresso é o objeto central da marca e merece tratamento próprio, não um card comum.

- Proporção retangular vertical com **entalhes laterais** (os "cortes" do ticket) — reproduzíveis com `radial-gradient` ou `mask`.
- Fundo Noite com **moldura de filete Ouro** de 1px, afastada ~10px da borda — é a assinatura visual do ticket Tessera em todas as fotos do Brand Book.
- Quadrifólio centralizado em Ouro no topo.
- Wordmark TESSERA em Playfair com letter-spacing largo.
- Área de QR em Luz sólida (o QR precisa de fundo claro para leitura por câmera).

### 8.7 Estados vazios

Momento de voz da marca, não erro. Símbolo (arco ou quadrifólio) em Ouro a baixa opacidade + título curto em Playfair + uma linha em Inter + ação.
Exemplo: *"Sua coleção começa aqui."* / "Cada evento vira uma peça da sua história." / **[Descobrir eventos]**

---

## 9. Tokens (CSS)

Bloco pronto para uso. **O produto suporta dois temas — Escuro (padrão) e Claro — com alternância pelo usuário** (ver §10.3). Escuro é literal ao Brand Book; Claro é extrapolação nossa validada por contraste (§9.4), sem precedente de tela no Brand Book.

**Regra de alternância:** o *chrome* (topbar, rodapé, formulários, cards, painéis — qualquer superfície neutra) muda com o tema. Elementos sobre gradiente ou imagem de marca (heroes, banners, capas de card) **não mudam** — o gradiente já carrega sua própria legibilidade, independente do tema ao redor.

```css
:root {
  /* ---------- Marca (Brand Book, p.12) ---------- */
  --noite:   #0C1324;
  --violeta: #6B2FA3;
  --laranja: #FF6A00;
  --ouro:    #C79A4A;
  --pedra:   #E6D7BE;
  --luz:     #FAF7F2;

  /* ---------- Rampas ---------- */
  --noite-900: #060B16;  --noite-800: #0C1324;  --noite-700: #131D33;
  --noite-600: #1B2743;  --noite-500: #243254;  --noite-400: #35456B;

  --violeta-700: #4E2178; --violeta-600: #6B2FA3; --violeta-500: #8248BE;
  --violeta-400: #9161C9; --violeta-300: #A87BD8; --violeta-200: #C6A8E6;

  --laranja-700: #A63F00; --laranja-600: #C24E00; --laranja-500: #FF6A00;
  --laranja-400: #FF8C3F; --laranja-300: #FFB07A;

  --ouro-700: #7A5A22; --ouro-600: #A07A35; --ouro-500: #C79A4A;
  --ouro-400: #D9B37A; --ouro-300: #E8CEA3;

  --pedra-800: #8C7856; /* passo extra — só usado como border-strong no tema claro, ver §9.4 */
  --pedra-700: #A8926C; --pedra-600: #CBB794; --pedra-500: #E6D7BE; --pedra-400: #EFE5D5;
  --luz-600: #F0EAE0;   --luz-500: #FAF7F2;

  /* ---------- Estado ---------- */
  --sucesso: #2F8F63; --sucesso-on-dark: #4FBF8B; --sucesso-on-light: #1F6B49;
  --erro:    #C4392A; --erro-on-dark:    #E8705F; --erro-on-light:    #A32B1C;
  --aviso:   #C79A4A; --aviso-on-dark:   #D9B37A; --aviso-on-light:   #7A5A22;
  --info:    #6B2FA3; --info-on-dark:    #A87BD8; --info-on-light:    #6B2FA3;

  /* ---------- Gradientes (Brand Book, p.12) — não alternam por tema ---------- */
  --grad-profundidade: linear-gradient(135deg, #0C1324 0%, #6B2FA3 100%);
  --grad-energia:      linear-gradient(135deg, #6B2FA3 0%, #FF6A00 100%);
  --grad-legado:       linear-gradient(135deg, #FF6A00 0%, #C79A4A 100%);

  /* ---------- Semântica: tema Escuro (padrão) ---------- */
  --bg:            var(--noite-800);
  --bg-deep:       var(--noite-900);
  --surface:       var(--noite-700);
  --surface-2:     var(--noite-600);
  --border:        var(--noite-500);
  --border-strong: var(--noite-400);
  --text:          var(--luz-500);
  --text-muted:    #A8B2C6;
  --text-accent:   var(--ouro-400);
  --action:        var(--laranja-500);
  --action-hover:  var(--laranja-400);
  --on-action:     var(--noite-800);
  --chrome-glass:  rgba(6, 11, 22, .78);   /* topbar/overlays translúcidos */
  --hover-tint:    rgba(250, 247, 242, .06); /* clarear no hover — tema escuro clareia */

  /* ---------- Texto de estado — sobre superfície que alterna com o tema ---------- */
  --text-success: var(--sucesso-on-dark);
  --text-error:   var(--erro-on-dark);
  --text-warning: var(--aviso-on-dark);
  --text-info:    var(--violeta-300);
  --text-emphasis-orange: var(--laranja-400); /* .em-laranja em título */

  /* ---------- Tipografia (Brand Book, p.13) ---------- */
  --font-display: "Playfair Display", Georgia, "Times New Roman", serif;
  --font-ui:      Inter, system-ui, -apple-system, "Segoe UI", sans-serif;

  --fs-display: clamp(2.5rem, 6vw + 1rem, 6rem);
  --fs-h1:      clamp(2rem, 4vw + .5rem, 4.5rem);
  --fs-h2:      clamp(1.75rem, 2.5vw + .5rem, 3rem);
  --fs-h3:      clamp(1.375rem, 1.5vw + .5rem, 2rem);
  --fs-body-lg: 1.125rem; --fs-body: 1rem; --fs-small: .875rem; --fs-micro: .75rem;

  --lh-display: 1.05; --lh-heading: 1.2; --lh-body: 1.6; --lh-small: 1.4;

  /* ---------- Espaçamento ---------- */
  --sp-2xs: 4px;  --sp-xs: 8px;  --sp-sm: 12px; --sp-md: 16px; --sp-lg: 24px;
  --sp-xl: 32px;  --sp-2xl: 48px; --sp-3xl: 64px; --sp-4xl: 96px; --sp-5xl: 128px;

  /* ---------- Forma ---------- */
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 20px;
  --radius-arch: 9999px 9999px 12px 12px;
  --radius-full: 9999px;

  /* ---------- Elevação ---------- */
  --shadow-1: 0 1px 2px rgba(0,0,0,.4);
  --shadow-2: 0 8px 24px -8px rgba(0,0,0,.6);
  --shadow-3: 0 24px 64px -16px rgba(0,0,0,.75);
  --glow-ouro:    0 0 0 1px rgba(199,154,74,.35), 0 8px 32px -12px rgba(199,154,74,.45);
  --glow-violeta: 0 0 0 1px rgba(107,47,163,.40), 0 8px 32px -12px rgba(107,47,163,.55);

  /* ---------- Movimento (Brand Book, p.16) ---------- */
  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --ease-in-out: cubic-bezier(.65, 0, .35, 1);
  --dur-fast: 150ms; --dur-base: 250ms; --dur-slow: 400ms; --dur-hero: 700ms;

  /* ---------- Layout ---------- */
  --container: 1200px; --container-wide: 1400px; --measure: 68ch;
}

/* ---------- Tema Claro — extrapolação nossa, sem precedente de tela no Brand Book.
   Cada valor abaixo foi verificado por contraste WCAG antes de entrar aqui — ver §9.4. ---------- */
[data-theme="light"] {
  --bg:            var(--luz-500);
  --bg-deep:       var(--luz-600);
  --surface:       #FFFFFF;
  --surface-2:     var(--pedra-400);
  --border:        var(--pedra-600);   /* divisores decorativos — não precisam de 3:1 */
  --border-strong: var(--pedra-800);   /* bordas funcionais (input, ticket) — 3.98:1 sobre Luz */
  --text:          var(--noite-800);
  --text-muted:    #5A6478;
  --text-accent:   var(--ouro-700);
  --action:        var(--laranja-500); /* preenchimento de botão não alterna — texto sempre Noite por cima */
  /* --action-hover não é redefinido — laranja-600 só rende 3.86:1 com texto Noite
     (reprova AA). Herda de :root: laranja-400, 8.0:1 nos dois temas — ver §9.4. */
  --on-action:     var(--noite-800);
  --chrome-glass:  rgba(255, 255, 255, .72);
  --hover-tint:    rgba(12, 19, 36, .05); /* tema claro escurece no hover, não clareia */

  --text-success: var(--sucesso-on-light);
  --text-error:   var(--erro-on-light);
  --text-warning: var(--aviso-on-light);
  --text-info:    var(--violeta-600);   /* violeta-300 só rende 3.03:1 sobre Luz — insuficiente para texto */
  --text-emphasis-orange: var(--laranja-700); /* laranja-400 rende 2.17:1 sobre Luz — reprova */

  --shadow-1: 0 1px 2px rgba(12, 19, 36, .10);
  --shadow-2: 0 8px 24px -8px rgba(12, 19, 36, .16);
  --shadow-3: 0 24px 64px -16px rgba(12, 19, 36, .22);
}
```

---

## 9.4 Tema Claro — verificação de contraste

Sem mockup de app claro no Brand Book, cada par abaixo foi calculado (WCAG 2.1, luminância relativa) antes de virar token. Onde o valor "óbvio" reprovava, o token aponta para uma rampa mais escura — igual ao processo já usado no tema escuro (§2.6).

| Token / uso | Valor | Contraste sobre Luz `#FAF7F2` | Nível |
|---|---|---|---|
| `--text` (corpo) | Noite `#0C1324` | 17.33 | AAA |
| `--text-muted` | `#5A6478` | 5.57 | AA |
| `--text-accent` (eyebrow, ícone) | Ouro-700 `#7A5A22` | 5.93 | AA |
| `--text-success` | `#1F6B49` | 6.03 | AA |
| `--text-error` | `#A32B1C` | 6.73 | AA |
| `--text-warning` | `#7A5A22` | 5.93 | AA |
| `--text-info` | Violeta-600 `#6B2FA3` | 7.67 | AAA |
| `--text-emphasis-orange` (`.em-laranja`) | Laranja-700 `#A63F00` | 5.90 | AA |
| `--border-strong` (não-texto, 3:1) | Pedra-800 `#8C7856` | 3.98 | passa (≥3) |

**O que reprovou e por quê ficou de fora:**

| Candidato óbvio | Contraste sobre Luz | Substituído por |
|---|---|---|
| Ouro-400 `#D9B37A` (foco/ícone no tema escuro) | 1.84 — **reprova** | Ouro-700 no tema claro |
| Ouro-300 `#E8CEA3` (hover de link no tema escuro) | 1.43 — **reprova** | Hover vira `--text` (Noite), não uma variação de Ouro |
| Laranja-500/400 (texto) | 2.69 / 2.17 — **reprovam** | Laranja-700 |
| Violeta-300 (texto info no tema escuro) | 3.03 — só AA-lg, insuficiente para texto normal | Violeta-600 (7.67, AAA) |
| Pedra-700 como borda funcional | 2.81 — abaixo de 3:1 | Pedra-800 (novo passo de rampa, 3.98) |
| Laranja-600 como `--action-hover` (texto Noite por cima) | 3.86 — só AA-lg, insuficiente para texto de botão (15px, não qualifica como "grande") | `--action-hover` não é redefinido no tema claro; herda Laranja-400 de `:root` (8.0:1, AAA nos dois temas) |

**Elementos que continuam iguais nos dois temas** (preenchimento de botão, badges com fundo translúcido de cor saturada, filetes decorativos de card/ticket, vinheta de hero/banner, scrim de modal): a superfície sob eles não muda — são cor sólida ou tingimento sobre gradiente de marca, não texto sobre fundo neutro. Não precisam de par claro/escuro porque o cálculo de contraste não muda.

---

## 10. Divergências encontradas no Brand Book

Registradas para que ninguém "conserte" de volta ao valor errado. Todas foram resolvidas em favor da página de especificação dedicada, que é mais confiável que a capa-resumo.

### 10.1 Hex de Violeta — erro de digitação

A página 12 imprime **`#0B2FA3`** ao lado da amostra de Violeta. `#0B2FA3` é um **azul royal**; a amostra impressa é claramente roxa.

Verificação: renderizando a página a 300 DPI e amostrando o centro da amostra, o pixel retorna `#663193`. Considerando a compressão JPEG das imagens embutidas, isso corresponde a `#6B2FA3` (Δ pequeno) e não a `#0B2FA3` (Δ enorme no canal vermelho: 107 vs 11).

**Conclusão:** o dígito `6` foi transcrito como `0`. **O valor correto é `#6B2FA3`.**

### 10.2 Tipografia — capa contradiz a especificação

| Fonte da informação | Títulos | Subtítulos | Corpo |
|---|---|---|---|
| Página 1 (capa-resumo) | Cormorant Garamond | Inter Medium | Inter Regular |
| **Página 13 (especificação de tipografia)** | **Playfair Display** | **Playfair Display** | **Inter** |

A página 13 é uma prancha dedicada, com amostra de alfabeto completo, hierarquia de cinco níveis, pesos e tamanhos. **Adotamos Playfair Display.**

### 10.3 Proporção de cor — capa contradiz a especificação → resolvido como dois temas de produto

| Fonte | Proporção |
|---|---|
| Página 1 (capa-resumo) | 70% Ivory · 20% Midnight Navy · 5% Festival Orange · 5% Creative Purple · Bronze em detalhes |
| Página 12 (especificação de cor) | 40% Noite · 20% Violeta · 15% Laranja · 10% Ouro · 10% Pedra · 5% Luz |

São dois sistemas diferentes: a capa descreve uma composição **clara** (dominada por Ivory/Luz); a página 12 descreve uma composição **escura** (dominada por Noite). As páginas 16 e 22 ("Motion & Digital Experience") mostram o app Tessera em fundo Noite escuro, o que confirma a página 12 como a composição do produto.

**Decisão (revisada):** em vez de tratar uma composição como "a certa" e a outra como material editorial, o produto suporta **os dois como temas completos — Escuro e Claro — com alternância pelo usuário**, escuro como padrão. Isso aproveita as duas composições que o Brand Book de fato desenhou, em vez de descartar uma delas.

**O que isso implica, e o que é extrapolação nossa:**

- Tema **Escuro** é literal ao Brand Book — mesma paleta, mesma proporção, mesmas páginas 16/22 como referência visual direta.
- Tema **Claro** usa a proporção da capa (Luz dominante, Noite em textos e detalhes) como ponto de partida, mas **o Brand Book não desenha nenhuma tela de produto em tema claro** — só a página de capa, que é material impresso, não UI. A adaptação de cada componente (botões, badges, cards, chrome) para o tema claro é uma extrapolação nossa, sem precedente visual direto no Brand Book. Compensamos a falta de precedente com verificação de contraste rigorosa (WCAG 2.1) em cada token — ver a tabela expandida na seção 9.4.
- Chrome (topbar, rodapé) alterna junto com o resto — não existe "banda sempre escura" nem meio-termo. Um toggle precisa ser previsível: o app inteiro muda, não parte dele.
- Elementos que ficam **sobre imagem ou gradiente de marca** (heroes, banners, capas de card) não alternam — o gradiente já é a marca, independente do tema da página ao redor. Só o *chrome* e as *superfícies neutras* (fundo, cards, painéis, formulários) alternam.

Isso está implementado em [`platform/preview/`](../platform/preview/) com um botão de alternância no topbar (ícone sol/lua), preferência salva em `localStorage` e leitura inicial de `prefers-color-scheme`.

### 10.4 Paleta alternativa do moodboard

A página 13 (moodboard) mostra uma paleta com nomes e valores diferentes: TERRA `#F36A21`, AMETISTA `#7B4DDB`, MARINHO `#0D1324`, AZUL CÉU `#3A6EA5`, AREIA `#DDD2C2`, PÉROLA `#F6F3EF`.

Trata-se de uma **exploração de moodboard**, não da paleta oficial — os valores são vizinhos dos oficiais (Terra ≈ Laranja, Ametista ≈ Violeta, Marinho ≈ Noite). A exceção é **Azul Céu `#3A6EA5`, que não tem equivalente na paleta principal** e não deve ser usado em produto.

**Não use esses valores.** A paleta oficial é a da página 12.

---

## Referências

- `docs/Tessera_Brand_Study_2.pdf` — Brand Book v1.0, 46 páginas (fonte primária deste documento)
- `docs/Tessera_Brand_Study.pdf` — estudo anterior
- `docs/Brand_Book_Tessera_v1.pdf`
- `platform/Brand_Study/Tessera_Logo_Manifesto_v1.md`
- `platform/Brand_Study/Creative_Direction_Tessera_Sprint_1.md`
- `docs/Identidade_Visual_e_Branding.md`

> **Mais que um ingresso. Uma experiência que permanece.**
