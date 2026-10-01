import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-canvas/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="font-serif text-xl font-semibold text-ink sm:text-2xl">
          Internship Tracker
        </Link>
      </div>
    </header>
  );
}
