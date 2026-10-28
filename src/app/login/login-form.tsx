"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { LoginState } from "@/server/auth/request-magic-link";
import type { CodeState } from "@/server/auth/sign-in-code";

import { sendMagicLink, signInWithCode } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            aria-invalid={state.status === "invalid" || undefined}
            aria-describedby="login-status"
            className="input"
          />
        </div>
        <Button type="submit" pending={pending} className="w-full">
          {pending ? "Sending…" : "Email me a sign-in link"}
        </Button>
        <p
          id="login-status"
          role="status"
          aria-live="polite"
          className={
            state.status === "invalid"
              ? "text-sm text-danger"
              : state.status === "sent"
                ? "rounded-lg bg-success-soft px-3 py-2 text-sm text-success"
                : "sr-only"
          }
        >
          {state.status === "idle" ? "" : state.message}
        </p>
      </form>
      {state.status === "sent" && <CodeForm key={state.email} email={state.email} />}
    </div>
  );
}

/**
 * Signs in with the code from the email instead of the link. Needed in the
 * home-screen app on iPhone, where the link opens in Safari instead.
 */
function CodeForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(signInWithCode, {
    status: "idle",
  });

  return (
    <form action={action} className="space-y-4 border-t border-line pt-6" noValidate>
      <input type="hidden" name="email" value={email} />
      <div className="space-y-1.5">
        <label htmlFor="code" className="block text-sm font-medium">
          Or enter the code from the email
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          required
          maxLength={12}
          aria-invalid={state.status === "invalid" || undefined}
          aria-describedby="code-status"
          className="input tracking-widest"
        />
      </div>
      <Button type="submit" pending={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in with code"}
      </Button>
      <p
        id="code-status"
        role="status"
        aria-live="polite"
        className={state.status === "invalid" ? "text-sm text-danger" : "sr-only"}
      >
        {state.status === "invalid" ? state.message : ""}
      </p>
    </form>
  );
}
