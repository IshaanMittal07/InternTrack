"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto max-w-lg space-y-4 rounded-xl bg-surface p-8 text-center shadow-card"
    >
      <h1 className="text-2xl font-semibold">Couldn’t load your tracker</h1>
      <p className="text-ink-muted">
        Something went wrong while loading your data. Your data is safe. Try again in a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
