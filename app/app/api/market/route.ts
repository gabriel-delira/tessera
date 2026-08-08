import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBrlPerUsdc } from "@/lib/fx";
import { computeResaleSplit } from "@/lib/split";
import { resaleFeeBps } from "@/lib/resaleCap";
import { computeAchievements, hashAchievements } from "@/lib/achievements";

// LAYOUT_UPDATE.md §5 — duas abas: "tickets" (eventos futuros) e "collectibles"
// (eventos já ocorridos). Corte é sempre por event.endDate < now() (não
// eventDate — PLANO_EVOLUCAO_V2.md §10.1/D35: um evento de vários dias não
// vira colecionável na primeira noite), nunca por EventStatus.ENDED (nada
// garante que esse status seja atualizado hoje — §5.1).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") === "collectibles" ? "collectibles" : "tickets";
  const eventId = searchParams.get("event");
  const now = new Date();

  const listings = await prisma.listing.findMany({
    where: {
      status:           "ACTIVE",
      onchainListingId: { not: null },
      ticket: {
        event: {
          ...(tab === "collectibles" ? { endDate: { lt: now } } : { endDate: { gte: now } }),
          // §9.2/D29 — deep link do card "Ver revenda" de um evento esgotado.
          ...(eventId ? { id: eventId } : {}),
        },
      },
    },
    include: {
      ticket: {
        include: {
          checkin: true,
          event: {
            select: {
              id:           true,
              title:        true,
              venue:        true,
              city:         true,
              eventDate:    true,
              coverImageUrl: true,
              maxResaleBps: true,
              platformFeeBps: true,
              royaltyBps: true,
              royaltyOrgShareBps: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const fxRate = await getBrlPerUsdc();

  // Troféus com prova — PLANO_EVOLUCAO_V2.md §6.3/D16 (atestado off-chain).
  // Só pra colecionáveis: é ali que a conquista do vendedor vira parte do
  // valor do anúncio ("colecionador de verdade", não só "tem o ingresso").
  const achievementsBySeller = new Map<string, { achieved: { id: string; icon: string; title: string }[]; hash: string }>();
  if (tab === "collectibles") {
    const sellers = [...new Set(listings.map((l) => l.sellerAddress))];
    await Promise.all(
      sellers.map(async (wallet) => {
        const achievements = await computeAchievements(wallet);
        achievementsBySeller.set(wallet, {
          achieved: achievements.filter((a) => a.achieved).map((a) => ({ id: a.id, icon: a.icon, title: a.title })),
          hash: hashAchievements(achievements, wallet),
        });
      })
    );
  }

  const result = listings.map((l) => {
    const priceBrl = Math.round(Number(l.price) * fxRate * 100) / 100;
    const { platformFeeBps, royaltyBps, royaltyOrgShareBps, ...event } = l.ticket.event;
    // Split — PLANO_EVOLUCAO_V2.md §10.2/A11: `priceBrl` é o pedido do
    // vendedor (sempre ≤ face, lib/resaleCap.ts), e a taxa da plataforma é
    // somada por cima pra virar o total que o comprador paga — não é mais
    // deduzida do vendedor. "Você recebe" (sellerShare) só desconta o
    // royalty do organizador, nunca a taxa de intermediação.
    const effectivePlatformFeeBps = resaleFeeBps({ platformFeeBps });
    const split = computeResaleSplit({ amount: priceBrl, platformFeeBps: effectivePlatformFeeBps, royaltyBps, royaltyOrgShareBps });

    return {
      id:              l.id,
      onchainListingId: l.onchainListingId,
      tokenId:         l.tokenId,
      sellerAddress:   l.sellerAddress,
      priceUsdc:       Number(l.price),
      priceBrl,
      totalBrl:        split.buyerTotal, // o que o comprador de fato paga (pedido + taxa destacada)
      paymentToken:    l.paymentToken,
      expiresAt:       l.expiresAt,
      createdAt:       l.createdAt,
      isCollectible:   tab === "collectibles",
      attendedEvent:   l.ticket.checkin !== null, // "Você esteve lá" — §5.3
      sellerReceivesBrl:   split.sellerShare,
      organizerRoyaltyBrl: split.organizerRoyalty,
      platformFeeBrl:      split.platformFee,    // taxa de intermediação, discriminada — nunca embutida no priceBrl
      platformTotalBrl:    split.platformTotal, // taxa da plataforma + parte dela no royalty
      sellerAchievements:  achievementsBySeller.get(l.sellerAddress)?.achieved ?? null,
      sellerAchievementsHash: achievementsBySeller.get(l.sellerAddress)?.hash ?? null,
      ticket: {
        tokenId:      l.ticket.tokenId,
        ticketNumber: l.ticket.ticketNumber,
        seat:         l.ticket.seat,
        facePrice:    Number(l.ticket.facePrice),
        event,
      },
    };
  });

  return NextResponse.json(result);
}
