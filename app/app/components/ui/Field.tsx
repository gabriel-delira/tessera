import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "h-11 rounded-md border border-border bg-surface-2 px-4 text-[15px] text-text placeholder:text-text-muted focus:border-ouro-400 focus:shadow-[0_0_0_3px_rgba(217,179,122,0.2)] focus:outline-none";

function Wrapper({
  label,
  error,
  children,
}: {
  label?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-text">{label}</span>}
      {children}
      {error && <span className="text-xs text-erro-on-dark">{error}</span>}
    </label>
  );
}

export function Field({
  label,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <Wrapper label={label} error={error}>
      <input className={`${fieldClass} ${className}`} {...props} />
    </Wrapper>
  );
}

export function SelectField({
  label,
  error,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <Wrapper label={label} error={error}>
      <select className={`${fieldClass} ${className}`} {...props}>
        {children}
      </select>
    </Wrapper>
  );
}

export function TextareaField({
  label,
  error,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <Wrapper label={label} error={error}>
      <textarea
        className={`${fieldClass} h-auto resize-none py-2.5 ${className}`}
        {...props}
      />
    </Wrapper>
  );
}
