// PLANO_EVOLUCAO_V2.md §5.4/D19 — capacidade pública de um evento, descontada
// a reserva do organizador ainda não usada. A parte já atribuída
// (reservedTicketsAssigned) já está contada em soldCount (virou Ticket como
// qualquer outra), então só a parte NÃO usada é que precisa sair da conta —
// senão a disponibilidade pública oscilaria toda vez que uma reserva fosse
// atribuída, quando na verdade ela é constante ao longo da vida do evento.
//
// maxTickets null = evento sem teto; reserva não reduz nada porque não há o
// que reduzir de uma oferta ilimitada.
export function publicAvailability(
  event: { maxTickets: number | null; reservedTickets: number; reservedTicketsAssigned: number },
  soldCount: number
): number | null {
  if (event.maxTickets === null) return null;
  const unusedReserve = event.reservedTickets - event.reservedTicketsAssigned;
  return event.maxTickets - soldCount - unusedReserve;
}
