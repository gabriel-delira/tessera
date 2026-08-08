import type { InputHTMLAttributes } from "react";

// PLANO_EVOLUCAO_V2.md §10.4/D39 — slider de percentual (meia-entrada, e o
// que mais precisar de "fração de um total conhecido"). Só faz sentido
// quando existe um total pra calcular a fração contra — sem isso é o
// checkbox de SelectField mesmo, não este componente.
export function RangeField({
  label,
  hint,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-text">{label}</span>}
      <input
        type="range"
        className={`h-2 w-full appearance-none rounded-full bg-surface-2 accent-ouro-500 ${className}`}
        {...props}
      />
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </label>
  );
}
