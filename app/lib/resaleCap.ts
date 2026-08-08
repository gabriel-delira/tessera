// Teto de revenda — PLANO_EVOLUCAO_V2.md §10.2/D36-D37, revisto em A11/A14.
//
// Decisão atual: o vendedor NUNCA pode pedir acima de 100% da face, em
// NENHUMA categoria — não é mais uma trava só de ESPORTE (art. 166 da Lei
// Geral do Esporte), nem uma escolha do organizador (D36 original). O motivo
// é que "revenda acima de 100%" mudou de definição: sobrepreço agora é medido
// no que o VENDEDOR recebe (sempre ≤ face), não no que o comprador paga. A
// plataforma pode cobrar uma taxa de intermediação por cima disso — ver
// resaleFeeBps e lib/split.ts — mas essa taxa é discriminada como linha
// própria no anúncio, nunca embutida no "valor do ingresso".
//
// A14 — em aberto: falta parecer jurídico confirmando se o art. 166 vale só
// pra ESPORTE ou pra qualquer evento (suspeita interna: qualquer evento).
// Também em aberto se a taxa de intermediação destacada por cima da face
// resiste a uma leitura judicial do "preço total pago" como sobrepreço — ver
// nota em lib/split.ts. Enquanto isso, o produto assume a leitura mais
// permissiva (taxa destacada é aceitável) por decisão do time, não por
// parecer confirmado.
export const LEGAL_CAP_BPS = 10_000; // 100% — vale pra toda categoria, sem exceção

export function isResaleCapMandatory(): boolean {
  return true;
}

// O organizador não escolhe mais o teto — ele é sempre 100% da face,
// independente do que vier no body. Mantido como função (em vez de constante
// inline nos call sites) só pra não espalhar o número mágico 10000.
export function resolveMaxResaleBps(): { ok: true; bps: number } {
  return { ok: true, bps: LEGAL_CAP_BPS };
}

// Teto da taxa destacada — a defensabilidade jurídica de "somar por cima"
// (em vez de deduzir do vendedor) depende de a taxa ser um valor "decente":
// explícita, verificável e não uma fração que pareça sobrepreço disfarçado.
// 100% de taxa em cima da face seria malandragem com CNPJ; 20% é o teto que
// o produto aceita cobrar assim. Não é número de lei — é bom-senso comercial
// até existir parecer (A14) que quantifique o que é "razoável".
export const MAX_RESALE_SERVICE_FEE_BPS = 2_000; // 20%

// Taxa de intermediação da plataforma — sempre cobrada, sempre por cima do
// pedido do vendedor (lib/split.ts calcula o total do comprador como
// `amount + platformFee`), e sempre limitada a MAX_RESALE_SERVICE_FEE_BPS
// independente do platformFeeBps configurado pra venda primária. Não existe
// mais a isenção "vendedor não lucrou": como o pedido do vendedor já é sempre
// ≤ face (resolveMaxResaleBps), ele nunca "lucra" nesse sentido — a taxa
// deixou de ser uma dedução do vendedor pra virar um acréscimo do comprador,
// então não há mais o que isentar.
export function resaleFeeBps(event: { platformFeeBps: number }): number {
  return Math.min(event.platformFeeBps, MAX_RESALE_SERVICE_FEE_BPS);
}
