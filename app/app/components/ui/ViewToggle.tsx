export function ViewToggle({
  value,
  onChange,
}: {
  value: "list" | "album";
  onChange: (v: "list" | "album") => void;
}) {
  return (
    <div role="tablist" aria-label="Modo de visualização" className="mb-6 inline-flex gap-1 rounded-full border border-border-strong p-1">
      {(["list", "album"] as const).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            value === v ? "bg-laranja-500 text-noite-800" : "text-text-muted hover:bg-white/5"
          }`}
        >
          {v === "list" ? "Lista" : "Álbum"}
        </button>
      ))}
    </div>
  );
}
