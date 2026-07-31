"use client";

import { useActionState, useState } from "react";
import { HindcastMark } from "@/components/hindcast-mark";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.2M6.6 6.6A17.2 17.2 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4.2-.9" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [show, setShow] = useState(false);

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-100">
        <div className="mb-5 flex items-center justify-center gap-2">
          <HindcastMark className="text-amber h-6 w-6" />
          <span className="text-[22px] font-semibold tracking-tight">
            hindcast
          </span>
        </div>

        <h1 className="text-center text-[18px] font-semibold tracking-tight">
          Unlock your Hindcast instance.
        </h1>
        <p className="text-muted mt-1.5 text-center text-[13px]">
          Enter your instance secret to continue.
        </p>

        <form action={formAction} className="mt-7">
          <label htmlFor="secret" className="text-muted mb-1.5 block text-[12px]">
            Instance secret
          </label>
          <div className="relative">
            <span className="text-muted pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
              <LockIcon />
            </span>
            <input
              id="secret"
              name="secret"
              type={show ? "text" : "password"}
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••••••"
              className="focus:border-amber w-full rounded-md border border-edge bg-surface py-2 pr-10 pl-9 font-mono text-[13px] outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              aria-label={show ? "Hide secret" : "Show secret"}
              className="text-muted hover:text-fg absolute inset-y-0 right-1 flex items-center rounded px-1.5 transition-colors"
            >
              <EyeIcon off={show} />
            </button>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="mt-2.5 w-full rounded-md bg-white py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Checking…" : "Unlock"}
          </button>

          {state.error ? (
            <p className="text-red mt-2.5 text-center text-[12px]">{state.error}</p>
          ) : (
            <p className="text-faint mt-4 text-center text-[12px]">
              Press{" "}
              <kbd className="border-edge text-muted rounded border px-1.5 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>{" "}
              to unlock
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
