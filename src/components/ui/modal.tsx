"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Accessible modal built on the native <dialog> element. `showModal()` makes
 * the rest of the page inert (focus stays inside), Escape closes it, and the
 * browser returns focus to the element that opened it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  variant = "dialog",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  variant?: "dialog" | "drawer";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const shape =
    variant === "drawer"
      ? "m-0 ml-auto h-dvh max-h-dvh w-full max-w-xl rounded-none sm:rounded-l-2xl"
      : "m-auto w-[calc(100%-2rem)] max-w-md rounded-xl";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop (the dialog element itself) closes it.
        if (event.target === ref.current) onClose();
      }}
      className={`bg-surface p-0 text-ink shadow-raised backdrop:bg-ink/40 ${shape}`}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0 space-y-1">
              <h2 id={titleId} className="text-xl font-semibold break-words">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-ink-muted hover:bg-surface-muted hover:text-ink"
              aria-label="Close"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="currentColor">
                <path d="M5.3 4.3a1 1 0 0 0-1.4 1.4L8.6 10l-4.7 4.3a1 1 0 1 0 1.4 1.4L10 11.4l4.3 4.3a1 1 0 0 0 1.4-1.4L11.4 10l4.3-4.3a1 1 0 0 0-1.4-1.4L10 8.6 5.3 4.3Z" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
