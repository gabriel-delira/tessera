// Meia-entrada — PLANO_EVOLUCAO_V2.md §5.5/D24. A cota é configurável por UF
// porque a Lei 12.933/2013 é federal e cobre estudante, idoso 60+, PcD (+
// acompanhante) e jovem de baixa renda do CadÚnico — mas não professor, que é
// obrigação estadual onde existir (SP entre eles). Config em arquivo (não em
// tabela do banco): decisão A2, fechada em 2026-08-03 — troca de lei estadual
// não é operação de runtime, e isso mantém a mudança revisável em PR.
//
// Hierarquia: UF preenchida → cota da UF; sem UF, mas país preenchido → cota
// do país; nem um nem outro → DEFAULT_QUOTA_BPS (40%, teto da obrigação
// federal e piso operacional adotado como prática de mercado — não é lei
// exigindo mínimo, é a escolha do produto).
//
// 4000 bps = 40%.
export const DEFAULT_QUOTA_BPS = 4000;

const COUNTRY_QUOTA_BPS: Record<string, number> = {
  BR: 4000,
};

// UF com regra própria (ex.: obrigação adicional de professor em alguns
// estados não muda o percentual da cota, só quem é elegível — por isso hoje
// não há estado com bps diferente de 40%; a tabela existe pronta pra quando
// houver, sem precisar tocar em schema/migration).
const STATE_QUOTA_BPS: Record<string, number> = {};

// PLANO_EVOLUCAO_V2.md §10.3/D38 — CORRIGE o racional original acima (D24):
// em evento coberto pela Lei 12.933/2013, os 40% NÃO são "piso operacional"
// por escolha do produto — são piso LEGAL obrigatório. A lei assegura o
// benefício em 40% dos ingressos de espetáculo artístico-cultural ou
// esportivo; "40% é teto da obrigação" só é verdade no sentido de que
// ninguém precisa oferecer MAIS que isso, não que oferecer menos seja opção.
//
// CONFERENCIA e OUTRO ficam de fora até A12 (PLANO_EVOLUCAO_V2.md §7) ser
// respondida — o texto da lei ("eventos educativos, de lazer e de
// entretenimento") é largo o bastante pra talvez cobrir as duas, mas isso
// precisa de parecer antes de travar a UI.
const MANDATORY_CATEGORIES = ["SHOW", "FESTIVAL", "TEATRO", "ESPORTE"] as const;

export function isSocialHalfMandatory(category: string): boolean {
  return (MANDATORY_CATEGORIES as readonly string[]).includes(category);
}

export function getSocialHalfQuotaBps(country: string | null | undefined, state: string | null | undefined): number {
  if (state) {
    const key = state.toUpperCase();
    if (key in STATE_QUOTA_BPS) return STATE_QUOTA_BPS[key];
  }
  if (country) {
    const key = country.toUpperCase();
    if (key in COUNTRY_QUOTA_BPS) return COUNTRY_QUOTA_BPS[key];
  }
  return DEFAULT_QUOTA_BPS;
}

// Teto de unidades de meia-entrada pro evento, arredondado pra baixo — nunca
// vender a 41ª meia numa cota de 40% por causa de arredondamento a favor da
// casa. null (sem maxTickets) = sem teto pra calcular contra; hasSocialHalf
// segue valendo, só não há um número fixo de vagas pra travar.
//
// PLANO_EVOLUCAO_V2.md §10.4/D39 — socialHalfBps é o percentual que o
// organizador escolheu no slider (pode oferecer mais que a cota legal);
// null = usa a cota legal calculada em runtime, que é o comportamento de
// todo evento criado antes desta fatia.
export function socialHalfCap(
  event: { maxTickets: number | null; country: string; state: string | null; socialHalfBps: number | null },
): number | null {
  if (event.maxTickets === null) return null;
  const bps = event.socialHalfBps ?? getSocialHalfQuotaBps(event.country, event.state);
  return Math.floor((event.maxTickets * bps) / 10000);
}
