import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "premium" | "danger" | "success";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-6 font-sans text-[15px] font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed";

const sizes = {
  md: "h-11",
  sm: "h-9 px-4 text-sm",
};

const variants: Record<Variant, string> = {
  primary: "bg-laranja-500 text-noite-800 hover:bg-laranja-400",
  secondary: "bg-transparent text-text border border-border-strong hover:bg-white/5 hover:border-ouro-500",
  ghost: "bg-transparent text-text-muted hover:bg-white/5 hover:text-text",
  premium: "text-noite-800 hover:brightness-110 [background:var(--grad-legado)]",
  danger: "bg-transparent text-erro-on-dark border border-erro-on-dark/50 hover:bg-erro-on-dark/10",
  success: "bg-sucesso-on-dark text-noite-800 hover:brightness-110",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "sm" }) {
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
  );
}
