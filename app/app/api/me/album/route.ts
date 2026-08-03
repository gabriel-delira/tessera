import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth";
import { computeAchievements } from "@/lib/achievements";

// LAYOUT_UPDATE.md §8.2 — conquistas para a visão em álbum de Minha Coleção.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!user.walletAddress) return NextResponse.json({ achievements: [] });

  const achievements = await computeAchievements(user.walletAddress);
  return NextResponse.json({ achievements });
}
