import { prisma } from "@/lib/db";
import { createHash } from "crypto";

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

  // Conta EVENTOS distintos, não linhas de check-in: com check-in por dia
  // (Checkin.dayId) um passe de 3 dias gera 3 linhas do mesmo evento, e
  // `checkins.length` daria a conquista "3 eventos" pra quem foi a um só.
  const eventCount = new Set(checkins.map((c) => c.ticket.eventId)).size;
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

  const achievements: Achievement[] = [
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

  return achievements;
}

// Atestado off-chain — PLANO_EVOLUCAO_V2.md §6.3/D16, escopo reduzido:
// decisão explícita de não escrever hash no contrato nesta fatia (não há
// campo pra isso em TicketNFTLocked.sol hoje; escrever exigiria função nova
// + redeploy, e o custo disso não foi avaliado — mesmo racional que manteve
// A1 em aberto na Onda 3). A "prova" aqui é a verificabilidade: qualquer um
// pode recomputar computeAchievements(wallet) a partir de Checkin/Ticket
// (dados já públicos via /api/market) e conferir o hash bate. Inclui a
// wallet no digest pra duas carteiras com o mesmo conjunto de conquistas
// não colidirem no mesmo hash.
export function hashAchievements(achievements: Achievement[], walletAddress: string): string {
  const achievedIds = achievements.filter((a) => a.achieved).map((a) => a.id).sort();
  const digest = createHash("sha256")
    .update(`${walletAddress.toLowerCase()}:${achievedIds.join(",")}`)
    .digest("hex");
  return `sha256:${digest}`;
}
