import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-muted">There’s nothing here.</p>
      <Link href="/" className="font-medium text-accent-text underline underline-offset-4">
        Back to your tracker
      </Link>
    </main>
  );
}
