import type { ReactNode } from "react";

export type PillTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "terracotta"
  | "sage"
  | "amber"
  | "slate"
  | "plum"
  | "teal";

const TONES: Record<PillTone, string> = {
  neutral: "bg-surface-muted text-ink-muted",
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  terracotta: "bg-tag-terracotta-bg text-tag-terracotta-fg",
  sage: "bg-tag-sage-bg text-tag-sage-fg",
  amber: "bg-tag-amber-bg text-tag-amber-fg",
  slate: "bg-tag-slate-bg text-tag-slate-fg",
  plum: "bg-tag-plum-bg text-tag-plum-fg",
  teal: "bg-tag-teal-bg text-tag-teal-fg",
};

/** Small status/tag label. Always carries text, so color is never the only signal. */
export function Pill({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
