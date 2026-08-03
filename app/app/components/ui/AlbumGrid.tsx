import { ShelfItem } from "./ShelfItem";
import { AchievementBadge } from "./AchievementBadge";
import type { Achievement } from "@/lib/achievements";

export interface AlbumTicket {
  tokenId: number;
  status: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  coverImageUrl: string | null;
  attended: boolean;
}

// LAYOUT_UPDATE.md §8.1 — ingressos futuros em seção própria no topo,
// separados dos colecionáveis; dentro do passado, agrupado por ano e evento
// (o que está por vir não se mistura com o que já foi).
export function AlbumGrid({
  tickets,
  achievements,
  onSelect,
}: {
  tickets: AlbumTicket[];
  achievements: Achievement[];
  onSelect: (tokenId: number) => void;
}) {
  const now = Date.now();
  const upcoming = tickets.filter((t) => new Date(t.eventDate).getTime() >= now);
  const past = tickets.filter((t) => new Date(t.eventDate).getTime() < now);

  const byYear = new Map<number, AlbumTicket[]>();
  for (const t of past) {
    const year = new Date(t.eventDate).getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(t);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  const grid = (items: AlbumTicket[]) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((t, i) => {
        const frozen = !["VALID", "CHECKED_IN"].includes(t.status);
        return (
          <ShelfItem
            key={t.tokenId}
            gradIndex={i}
            coverImageUrl={t.coverImageUrl}
            title={t.eventTitle}
            subtitle={`${new Date(t.eventDate).toLocaleDateString("pt-BR")} · ${t.city}`}
            frozen={frozen}
            attended={t.attended}
            onClick={() => onSelect(t.tokenId)}
          />
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-10">
      {achievements.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-lg text-text">Conquistas</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {achievements.map((a) => <AchievementBadge key={a.id} achievement={a} />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-lg text-text">Próximos</h3>
          {grid(upcoming)}
        </div>
      )}

      {years.map((year) => (
        <div key={year}>
          <h3 className="mb-3 font-display text-lg text-text">{year}</h3>
          {grid(byYear.get(year)!)}
        </div>
      ))}
    </div>
  );
}
