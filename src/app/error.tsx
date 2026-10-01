"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-ink-muted">
        The page couldn’t be loaded. Your data is safe. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-hover"
      >
        Try again
      </button>
    </main>
  );
}
