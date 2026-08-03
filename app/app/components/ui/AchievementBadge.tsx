import { Icon, type IconName } from "./Icon";
import type { Achievement } from "@/lib/achievements";

export function AchievementBadge({ achievement }: { achievement: Achievement }) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center ${
        achievement.achieved ? "border-ouro-500/40 bg-surface" : "border-border bg-surface opacity-40"
      }`}
      title={achievement.description}
    >
      <Icon name={achievement.icon as IconName} className={`h-6 w-6 ${achievement.achieved ? "text-ouro-400" : "text-text-muted"}`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text">{achievement.title}</p>
    </div>
  );
}
