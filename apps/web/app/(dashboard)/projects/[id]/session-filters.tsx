"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const selectClass =
  "rounded-md border border-edge bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-edge-strong";

export function SessionFilters({ devices }: { devices: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const device = params.get("device") ?? "";
  const dur = params.get("dur") ?? "";
  const errorsOnly = params.get("errors") === "1";

  const apply = (patch: Record<string, string | null>): void => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("p"); // a changed filter starts back at page one
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const anyActive = Boolean(q || device || dur || errorsOnly);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("q");
          apply({ q: typeof value === "string" ? value.trim() : null });
        }}
      >
        <input
          key={q}
          name="q"
          defaultValue={q}
          placeholder="Search id, url or page"
          className="w-56 rounded-md border border-edge bg-surface px-3 py-1.5 text-[13px] outline-none placeholder:text-faint focus:border-edge-strong"
        />
      </form>

      <select
        value={device}
        onChange={(event) => apply({ device: event.target.value })}
        aria-label="Device"
        className={selectClass}
      >
        <option value="">All devices</option>
        {devices.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <select
        value={dur}
        onChange={(event) => apply({ dur: event.target.value })}
        aria-label="Duration"
        className={selectClass}
      >
        <option value="">Any length</option>
        <option value="short">Under 1m</option>
        <option value="medium">1–5m</option>
        <option value="long">Over 5m</option>
      </select>

      <button
        type="button"
        onClick={() => apply({ errors: errorsOnly ? null : "1" })}
        aria-pressed={errorsOnly}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] transition-colors ${
          errorsOnly
            ? "border-red/50 text-fg"
            : "border-edge text-muted hover:text-fg"
        }`}
      >
        <span className="bg-red h-1.5 w-1.5 rounded-full" />
        Errors only
      </button>

      {anyActive ? (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-faint px-1 text-[13px] hover:text-fg"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
