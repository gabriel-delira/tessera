// Teto de revenda — PLANO_EVOLUCAO_V2.md §10.2/D36-D37.
//
// A premissa "revenda acima do valor original é ilegal" só vale pra ESPORTE:
// art. 166 da Lei Geral do Esporte (14.597/2023) — crime, reclusão 1-2 anos,
// mas alcança só evento esportivo. Pra show/teatro/festival não há tipo penal
// federal; o risco é CDC (prática abusiva) e Lei 1.521/51 art.4º (economia
// popular) quando configura especulação — não a simples revenda acima da face.
//
// Por isso: ESPORTE trava em 100% (conformidade, não escolha). Nas demais
// categorias, 100% é DEFAULT DE PRODUTO — o organizador pode afrouxar; o
// antigo piso de "nunca abaixo de 100%" também caía por terra (nada na lei
// impede um organizador de exigir desconto na revenda).
export const LEGAL_CAP_CATEGORIES = ["ESPORTE"] as const;
export const LEGAL_CAP_BPS = 10_000; // 100%

export function isResaleCapMandatory(category: string): boolean {
  return (LEGAL_CAP_CATEGORIES as readonly string[]).includes(category);
}

// Resolve o teto pedido pelo organizador em bps, ou erro. Categoria travada
// SEMPRE volta 10000, ignorando o que veio no body — validação de servidor,
// não de UI. `null` = mercado livre, só permitido fora da categoria travada.
export function resolveMaxResaleBps(
  category: string,
  requested: number | null
): { ok: true; bps: number | null } | { ok: false; error: string } {
  if (isResaleCapMandatory(category)) {
    return { ok: true, bps: LEGAL_CAP_BPS };
  }
  if (requested === null) return { ok: true, bps: null };
  if (!Number.isInteger(requested) || requested < 1) {
    return { ok: false, error: "maxResaleBps must be a positive integer, or omitted for no cap" };
  }
  return { ok: true, bps: requested };
}

// D37 — não dá pra "subir um pouco pra cobrir taxa": isso faz o COMPRADOR
// pagar acima da face, que é exatamente a conduta vedada em esporte e a
// exposta ao CDC nas demais. O caminho lícito é a plataforma abrir mão da
// própria taxa quando o vendedor não lucrou (preço ≤ face) — assim ele
// consegue recuperar perto dos 100% sem que o preço pago suba. A regra é
// "não lucrou", não "está exatamente no teto": 99% da face também isenta.
export function resaleFeeBps(
  event: { platformFeeBps: number },
  priceUsdc: number,
  facePrice: number
): number {
  return priceUsdc <= facePrice ? 0 : event.platformFeeBps;
}
