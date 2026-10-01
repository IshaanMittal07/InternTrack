import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="font-serif text-xl font-semibold text-ink sm:text-2xl">
          Internship Tracker
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <Link href="/" className={buttonClasses("ghost", "sm")}>
            Dashboard
          </Link>
          <Link href="/tags" className={buttonClasses("ghost", "sm")}>
            Manage tags
          </Link>
          <a href="/export" className={buttonClasses("ghost", "sm")} download>
            Export CSV
          </a>
          <form action="/auth/signout" method="post">
            <button type="submit" className={buttonClasses("secondary", "sm")}>
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
