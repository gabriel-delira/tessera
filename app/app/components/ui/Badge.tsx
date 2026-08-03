type Variant = "success" | "error" | "warning" | "info" | "neutral";

const variants: Record<Variant, string> = {
  success: "bg-sucesso-on-dark/15 text-sucesso-on-dark",
  error: "bg-erro-on-dark/15 text-erro-on-dark",
  warning: "bg-ouro-400/15 text-ouro-400",
  info: "bg-violeta-300/15 text-violeta-300",
  neutral: "bg-surface-2 text-text-muted",
};

const floatVariants: Record<Variant, string> = {
  success: "bg-noite-900/85 text-sucesso-on-dark",
  error: "bg-noite-900/85 text-erro-on-dark",
  warning: "bg-noite-900/85 text-ouro-400",
  info: "bg-noite-900/85 text-violeta-300",
  neutral: "bg-noite-900/85 text-text-muted",
};

export function Badge({
  variant = "neutral",
  float = false,
  children,
  className = "",
}: {
  variant?: Variant;
  float?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] ${
        float ? floatVariants[variant] : variants[variant]
      } ${className}`}
    >
      {children}
    </span>
  );
}
