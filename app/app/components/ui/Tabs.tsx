export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="tablist" className="mb-6 flex gap-2">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={active === t.value}
          onClick={() => onChange(t.value)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            active === t.value
              ? "bg-laranja-500 text-noite-800"
              : "border border-border-strong text-text-muted hover:bg-white/5"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
