export function Panel({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border border-border bg-surface ${className}`}>
      {title && (
        <div className="flex items-center gap-2 border-b border-border px-[18px] py-3.5 font-display text-[17px] text-text">
          {icon}
          <span className="flex-1">{title}</span>
          {action}
        </div>
      )}
      <div className="p-[18px]">{children}</div>
    </div>
  );
}
