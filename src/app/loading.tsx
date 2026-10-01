export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 items-center justify-center p-12">
      <span className="text-ink-muted">Loading…</span>
    </div>
  );
}
