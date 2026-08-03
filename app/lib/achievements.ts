import { prisma } from "@/lib/db";

// LAYOUT_UPDATE.md §8.2 — conquistas calculadas em tempo de leitura a partir
// de Ticket + Checkin + Event, sem model novo nesta rodada. Retroativas por
// construção (derivam de dados históricos), então não exigem backfill.
//
// Fora de escopo: conquistas de série/turnê ("3 de 5 shows da turnê"), que
// dependem de um model de série que não existe ainda. Quando existir, entra
// nesta mesma função sem reescrever a tela que a consome.

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  achieved: boolean;
}

const ANO_COMPLETO_MESES = 3;

export async function computeAchievements(walletAddress: string): Promise<Achievement[]> {
  const checkins = await prisma.checkin.findMany({
    where: { ticket: { ownerAddress: walletAddress } },
    include: { ticket: { include: { event: true } } },
    orderBy: { scannedAt: "asc" },
  });

  const eventCount = checkins.length;
  const cities = new Set(checkins.map((c) => c.ticket.event.city));
  const monthsByYear = new Map<number, Set<number>>();
  for (const c of checkins) {
    const d = c.scannedAt;
    const year = d.getFullYear();
    if (!monthsByYear.has(year)) monthsByYear.set(year, new Set());
    monthsByYear.get(year)!.add(d.getMonth());
  }
  const anoCompleto = [...monthsByYear.values()].some((months) => months.size >= ANO_COMPLETO_MESES);

  const first = checkins[0];

  return [
    {
      id: "voce-esteve-la",
      icon: "quadrifolio",
      title: "Você esteve lá",
      description: "Fez check-in em pelo menos um evento",
      achieved: eventCount >= 1,
    },
    {
      id: "primeiro-evento",
      icon: "portal",
      title: "Primeiro evento",
      description: first ? `${first.ticket.event.title}` : "Ainda não registrado",
      achieved: !!first,
    },
    {
      id: "eventos-3",
      icon: "ticket",
      title: "3 eventos",
      description: `${Math.min(eventCount, 3)} de 3 eventos com check-in`,
      achieved: eventCount >= 3,
    },
    {
      id: "cidades-3",
      icon: "local",
      title: "3 cidades visitadas",
      description: `${Math.min(cities.size, 3)} de 3 cidades`,
      achieved: cities.size >= 3,
    },
    {
      id: "ano-completo",
      icon: "calendario",
      title: "Ano ativo",
      description: `Check-in em ${ANO_COMPLETO_MESES}+ meses distintos de um mesmo ano`,
      achieved: anoCompleto,
    },
  ];
}
