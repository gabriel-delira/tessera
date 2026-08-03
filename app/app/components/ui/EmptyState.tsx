import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon = "quadrifolio",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
      <Icon name={icon} className="h-16 w-16 text-ouro-400 opacity-50" />
      <h3 className="font-display text-xl text-text">{title}</h3>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action}
    </div>
  );
}
