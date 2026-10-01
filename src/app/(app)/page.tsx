import { requireUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  await requireUser();

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <h1 id="dashboard-heading" className="text-3xl font-semibold sm:text-4xl">
        Your internship search
      </h1>
      <div className="rounded-xl bg-surface p-6 shadow-card">
        <p className="text-ink-muted">
          The dashboard arrives in a later build phase. This page confirms the layout, fonts,
          colors, and security headers are working.
        </p>
        <p className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-tag-terracotta-bg px-3 py-1 text-sm font-medium text-tag-terracotta-fg">
            Cybersecurity
          </span>
          <span className="rounded-full bg-tag-sage-bg px-3 py-1 text-sm font-medium text-tag-sage-fg">
            Quantum
          </span>
          <span className="rounded-full bg-tag-teal-bg px-3 py-1 text-sm font-medium text-tag-teal-fg">
            AI/ML
          </span>
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-accent px-4 py-2 font-medium text-on-accent shadow-card transition-colors hover:bg-accent-hover"
        >
          Primary action
        </button>
      </div>
    </section>
  );
}
