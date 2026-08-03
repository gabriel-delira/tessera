export function PageTitle({
  children,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-[2rem] font-medium leading-tight text-text">{children}</h1>
        {subtitle && <p className="mt-1.5 max-w-prose text-[15px] text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Emphasis({ children }: { children: React.ReactNode }) {
  return <em className="text-laranja-400 not-italic">{children}</em>;
}
