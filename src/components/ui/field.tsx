import type { ReactNode } from "react";

/** Label + control + hint/error, wired together for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  className = "",
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="text-ink-muted" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** aria props for a control inside <Field>. */
export function fieldAria(id: string, error?: string, hint?: string) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return {
    id,
    name: id.split("--")[0],
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;
}
