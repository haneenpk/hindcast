"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="w-80">
        <div className="mb-6 flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden>
            <path d="M16 10v12l-8.5-6z" fill="var(--color-amber)" />
            <path d="M25 10v12l-8.5-6z" fill="var(--color-amber)" opacity="0.45" />
          </svg>
          <span className="font-mono text-[13px] font-medium tracking-tight">
            hindcast
          </span>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <label className="text-muted text-[13px]" htmlFor="secret">
            Admin secret
          </label>
          <input
            id="secret"
            name="secret"
            type="password"
            autoFocus
            autoComplete="current-password"
            className="rounded-md border border-edge bg-surface px-3 py-2 font-mono text-[13px] outline-none placeholder:text-faint focus:border-edge-strong"
            placeholder="••••••••••••"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-white px-3 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Checking…" : "Unlock"}
          </button>
          {state.error ? (
            <p className="text-red text-[13px]">{state.error}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
