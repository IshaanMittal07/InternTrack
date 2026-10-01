import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link is invalid or has expired. Request a new one.",
  "signed-out": "You have been signed out. Please sign in again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-xl bg-surface p-6 shadow-card sm:p-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Internship Tracker</h1>
          <p className="text-ink-muted">Sign in with a one-time link sent to your email.</p>
        </div>
        {message && (
          <p role="alert" className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            {message}
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
