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
export function socialHalfCap(
  event: { maxTickets: number | null; country: string; state: string | null },
): number | null {
  if (event.maxTickets === null) return null;
  const bps = getSocialHalfQuotaBps(event.country, event.state);
  return Math.floor((event.maxTickets * bps) / 10000);
}
