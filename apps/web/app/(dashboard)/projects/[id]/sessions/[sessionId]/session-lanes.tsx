"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format";

export interface LaneFocus {
  id: string;
  kind: "error" | "network";
  nonce: number;
}

export interface ConsoleEntry {
  id: string;
  timestamp: number;
  source: string;
  message: string;
  stack: string | null;
  pageUrl: string | null;
}

export interface NetworkEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
}

type Selection =
  | { kind: "console"; entry: ConsoleEntry }
  | { kind: "network"; entry: NetworkEntry };

const SOURCE_LABEL: Record<string, string> = {
  WINDOW_ERROR: "uncaught",
  UNHANDLED_REJECTION: "rejection",
  CONSOLE_ERROR: "console.error",
};

function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

const timeFormat = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function SessionLanes({
  consoleEntries,
  networkEntries,
  startTime,
  totalMs,
  onJump,
  focus = null,
}: {
  consoleEntries: ConsoleEntry[];
  networkEntries: NetworkEntry[];
  startTime: number;
  totalMs: number;
  onJump(offsetMs: number): void;
  focus?: LaneFocus | null;
}) {
  const [tab, setTab] = useState<"console" | "network">(
    consoleEntries.length > 0 || networkEntries.length === 0
      ? "console"
      : "network",
  );
  const [selected, setSelected] = useState<Selection | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const offsetOf = (timestamp: number): number =>
    Math.min(Math.max(timestamp - startTime, 0), totalMs);

  // Driven by a marker click on the scrubber: bring the matching row into
  // its lane and pulse it, so an error on the timeline and its detail row
  // are unmistakably the same event.
  useEffect(() => {
    if (!focus) return;
    setTab(focus.kind === "error" ? "console" : "network");
    const id = focus.id;
    const timer = setTimeout(() => {
      const row = rootRef.current?.querySelector<HTMLElement>(
        `[data-entry-id="${CSS.escape(id)}"]`,
      );
      if (!row) return;
      row.scrollIntoView({ block: "nearest" });
      try {
        row.animate(
          [
            { backgroundColor: "rgba(255,255,255,0.07)" },
            { backgroundColor: "rgba(255,255,255,0)" },
          ],
          { duration: 900, easing: "ease-out" },
        );
      } catch {
        /* WAAPI not available — the scroll still landed it */
      }
    }, 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  return (
    <div ref={rootRef} className="mt-4 rounded-lg border border-edge bg-surface">
      <div className="flex gap-1 border-b border-edge px-2 pt-1.5">
        {(
          [
            { key: "console", label: "Console", count: consoleEntries.length },
            { key: "network", label: "Network", count: networkEntries.length },
          ] as const
        ).map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b px-3 pb-2 text-[13px] transition-colors ${
              tab === key
                ? "border-fg text-fg"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {label}
            <span className="text-faint ml-1.5 text-xs tabular-nums">
              {count}
            </span>
          </button>
        ))}
      </div>

      {tab === "console" ? (
        consoleEntries.length === 0 ? (
          <p className="text-faint px-4 py-6 text-[13px]">
            Nothing hit the console.
          </p>
        ) : (
          <ul className="max-h-64 divide-y divide-edge overflow-y-auto">
            {consoleEntries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  data-entry-id={entry.id}
                  onClick={() => setSelected({ kind: "console", entry })}
                  className="grid w-full grid-cols-[8px_minmax(0,1fr)_auto_44px] items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-raised/50"
                >
                  <span className="bg-red h-1.5 w-1.5 rounded-full" />
                  <span className="truncate text-[13px]">{entry.message}</span>
                  <span className="text-faint text-[11px] tracking-wide uppercase">
                    {SOURCE_LABEL[entry.source] ?? entry.source}
                  </span>
                  <span className="text-muted text-right font-mono text-xs tabular-nums">
                    {formatClock(offsetOf(entry.timestamp))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : networkEntries.length === 0 ? (
        <p className="text-faint px-4 py-6 text-[13px]">
          No requests recorded.
        </p>
      ) : (
        <ul className="max-h-64 divide-y divide-edge overflow-y-auto">
          {networkEntries.map((entry) => {
            const failed = entry.status === null || entry.status >= 400;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  data-entry-id={entry.id}
                  onClick={() => setSelected({ kind: "network", entry })}
                  className="grid w-full grid-cols-[44px_minmax(0,1fr)_60px_56px_44px] items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-raised/50"
                >
                  <span className="font-mono text-xs">{entry.method}</span>
                  <span className="truncate text-[13px]">
                    {pathOf(entry.url)}
                  </span>
                  <span
                    className={`font-mono text-xs ${failed ? "text-red" : "text-muted"}`}
                  >
                    {entry.status ?? "—"}
                  </span>
                  <span className="text-muted text-right font-mono text-xs tabular-nums">
                    {entry.durationMs !== null ? `${entry.durationMs}ms` : "—"}
                  </span>
                  <span className="text-muted text-right font-mono text-xs tabular-nums">
                    {formatClock(offsetOf(entry.timestamp))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <Drawer
          selection={selected}
          offsetMs={offsetOf(selected.entry.timestamp)}
          onClose={() => setSelected(null)}
          onJump={(offset) => {
            onJump(offset);
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Drawer({
  selection,
  offsetMs,
  onClose,
  onJump,
}: {
  selection: Selection;
  offsetMs: number;
  onClose(): void;
  onJump(offsetMs: number): void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { entry } = selection;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-md max-w-[90vw] flex-col border-l border-edge bg-surface">
        <header className="flex items-center justify-between border-b border-edge px-5 py-3">
          <h2 className="text-[13px] font-medium">
            {selection.kind === "console"
              ? (SOURCE_LABEL[selection.entry.source] ?? "error")
              : "request"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted rounded-md px-2 py-0.5 text-sm hover:text-fg"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <dl className="mb-4 space-y-2.5">
            <DetailRow label="At">
              <span className="font-mono text-xs">
                {formatClock(offsetMs)} into the session ·{" "}
                {timeFormat.format(new Date(entry.timestamp))}
              </span>
            </DetailRow>

            {selection.kind === "console" ? (
              <>
                {selection.entry.pageUrl ? (
                  <DetailRow label="Page">
                    <span className="font-mono text-xs break-all">
                      {selection.entry.pageUrl}
                    </span>
                  </DetailRow>
                ) : null}
                <DetailRow label="Message">
                  <span className="text-[13px] break-words">
                    {selection.entry.message}
                  </span>
                </DetailRow>
              </>
            ) : (
              <>
                <DetailRow label="Request">
                  <span className="font-mono text-xs break-all">
                    {selection.entry.method} {selection.entry.url}
                  </span>
                </DetailRow>
                <DetailRow label="Status">
                  <span
                    className={`font-mono text-xs ${
                      selection.entry.status === null ||
                      selection.entry.status >= 400
                        ? "text-red"
                        : "text-green"
                    }`}
                  >
                    {selection.entry.status ?? "no response"}
                  </span>
                </DetailRow>
                <DetailRow label="Duration">
                  <span className="font-mono text-xs">
                    {selection.entry.durationMs !== null
                      ? `${selection.entry.durationMs}ms`
                      : "—"}
                  </span>
                </DetailRow>
                <DetailRow label="Body">
                  <span className="text-muted text-[13px]">
                    Never recorded — request and response payloads stay in
                    the visitor&apos;s browser.
                  </span>
                </DetailRow>
              </>
            )}
          </dl>

          {selection.kind === "console" && selection.entry.stack ? (
            <pre className="overflow-x-auto rounded-md border border-edge bg-bg p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {selection.entry.stack}
            </pre>
          ) : null}
        </div>

        <footer className="border-t border-edge px-5 py-3">
          <button
            type="button"
            onClick={() => onJump(offsetMs)}
            className="w-full rounded-md bg-white px-3 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90"
          >
            Jump to this moment
          </button>
        </footer>
      </aside>
    </>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
      <dt className="text-faint pt-px text-[11px] tracking-wide uppercase">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
