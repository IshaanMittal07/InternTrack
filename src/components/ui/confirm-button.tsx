"use client";

import { useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "@/lib/action-result";

import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { Modal } from "./modal";

/** A button that asks for confirmation before running a (server) action. */
export function ConfirmButton({
  children,
  title,
  message,
  confirmLabel = "Delete",
  confirmVariant = "danger",
  variant = "ghost",
  size = "sm",
  className,
  onConfirm,
  onDone,
}: {
  children: ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  onConfirm: () => Promise<ActionResult>;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {children}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <p className="text-ink-muted">{message}</p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await onConfirm();
                if (result.ok) {
                  setOpen(false);
                  onDone?.();
                } else {
                  setError(result.error);
                }
              })
            }
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
