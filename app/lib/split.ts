// Split de revenda — LAYOUT_UPDATE.md §5.7, redesenhado em PLANO_EVOLUCAO_V2.md
// §10.2/A11: a taxa da plataforma não é mais deduzida do preço que o vendedor
// pede — ela é SOMADA por cima e cobrada do comprador, discriminada como linha
// própria ("Valor do Ingresso" + "Taxa de Intermediação" = total pago). Isso é
// o que sustenta o argumento de que o vendedor nunca recebe acima da face
// (art. 166 da Lei Geral do Esporte): `amount` já é o pedido do vendedor,
// capado em 100% da face em toda categoria (lib/resaleCap.ts), e a plataforma
// nunca tira desse valor — só acrescenta por cima, do lado do comprador.
//
// O royalty do organizador é uma dedução à parte (ERC-2981, não é a taxa de
// serviço da plataforma) e continua saindo do valor pedido pelo vendedor.
//
// ATENÇÃO — aproximação conhecida: o contrato (`TicketResale`/`RoyaltySplitter`)
// ainda calcula sua própria taxa como % do total submetido on-chain, não do
// valor de face isolado; a settlement on-chain de fato ainda não reflete essa
// soma-por-cima até `smart_contracts/` ser atualizado. Este split é a fonte de
// verdade da EXIBIÇÃO (anúncio, checkout) e da validação de preço; o valor
// que a plataforma retém on-chain pode variar de `platformFee` até lá.
export interface ResaleSplitInput {
  amount: number; // pedido do vendedor (face, já capado em 100%), na moeda que for
  platformFeeBps: number;
  royaltyBps: number;
  royaltyOrgShareBps: number;
}

export interface ResaleSplit {
  sellerShare: number;   // amount - royaltyTotal (a taxa da plataforma não entra aqui)
  organizerRoyalty: number;
  platformRoyalty: number;
  platformFee: number;   // taxa de intermediação, somada por cima — não sai do vendedor
  platformTotal: number; // platformFee + platformRoyalty
  buyerTotal: number;    // amount + platformFee — o que o comprador de fato paga
}

export function computeResaleSplit(input: ResaleSplitInput): ResaleSplit {
  const { amount, platformFeeBps, royaltyBps, royaltyOrgShareBps } = input;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const royaltyTotal      = (amount * royaltyBps) / 10_000;
  const organizerRoyalty  = round2((royaltyTotal * royaltyOrgShareBps) / 10_000);
  const platformRoyalty   = round2(royaltyTotal - organizerRoyalty);
  const platformFee       = round2((amount * platformFeeBps) / 10_000);
  const sellerShare       = round2(amount - royaltyTotal);

  return {
    sellerShare,
    organizerRoyalty,
    platformRoyalty,
    platformFee,
    platformTotal: round2(platformFee + platformRoyalty),
    buyerTotal: round2(amount + platformFee),
  };
}
