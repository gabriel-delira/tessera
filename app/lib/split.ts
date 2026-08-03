// Split de revenda — LAYOUT_UPDATE.md §5.7. Mesma fórmula usada pelo contrato
// em TicketResale._buyListed / settleListedTicket e pelo RoyaltySplitter, só
// que calculada em BRL para alimentar o ledger no Fluxo Reais. platformFeeBps
// e royaltyBps vêm sempre do Event, nunca de valor solto — é o mesmo número
// que o contrato usa via royaltyInfo(), então os dois cálculos não podem divergir.
export interface ResaleSplitInput {
  amount: number; // preço acordado, na moeda que for (BRL para ledger, USDC para o contrato)
  platformFeeBps: number;
  royaltyBps: number;
  royaltyOrgShareBps: number;
}

export interface ResaleSplit {
  sellerShare: number;
  organizerRoyalty: number;
  platformRoyalty: number;
  platformFee: number;
  platformTotal: number; // platformFee + platformRoyalty
}

export function computeResaleSplit(input: ResaleSplitInput): ResaleSplit {
  const { amount, platformFeeBps, royaltyBps, royaltyOrgShareBps } = input;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const royaltyTotal      = (amount * royaltyBps) / 10_000;
  const organizerRoyalty  = round2((royaltyTotal * royaltyOrgShareBps) / 10_000);
  const platformRoyalty   = round2(royaltyTotal - organizerRoyalty);
  const platformFee       = round2((amount * platformFeeBps) / 10_000);
  const sellerShare       = round2(amount - royaltyTotal - platformFee);

  return {
    sellerShare,
    organizerRoyalty,
    platformRoyalty,
    platformFee,
    platformTotal: round2(platformFee + platformRoyalty),
  };
}
