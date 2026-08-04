import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { computeAchievements, hashAchievements } from "@/lib/achievements";

// LAYOUT_UPDATE.md §8.2 — conquistas para a visão em álbum de Minha Coleção.
// achievementsHash — PLANO_EVOLUCAO_V2.md §6.3/D16 (atestado off-chain).
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!user.walletAddress) return NextResponse.json({ achievements: [], achievementsHash: null });

  const achievements = await computeAchievements(user.walletAddress);
  return NextResponse.json({ achievements, achievementsHash: hashAchievements(achievements, user.walletAddress) });
}
