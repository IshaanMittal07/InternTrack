/** Announces a form's error or success message to screen readers. */
export function FormStatus({ error, success }: { error?: string | null; success?: string | null }) {
  return (
    <p role="status" aria-live="polite" className="min-h-5 text-sm">
      {error ? (
        <span className="text-danger">{error}</span>
      ) : success ? (
        <span className="text-success">{success}</span>
      ) : null}
    </p>
  );
}
