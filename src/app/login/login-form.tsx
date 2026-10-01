"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { LoginState } from "@/server/auth/request-magic-link";

import { sendMagicLink } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });

  return (
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
  );
}
