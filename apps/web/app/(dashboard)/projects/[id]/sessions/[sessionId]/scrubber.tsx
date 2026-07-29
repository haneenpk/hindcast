"use client";

import { useMemo, useRef, useState } from "react";
import { formatClock } from "@/lib/format";

interface Cluster {
  markers: ScrubberMarker[];
  offsetMs: number;
  hasError: boolean;
}

export interface ScrubberMarker {
  id: string;
  kind: "error" | "network";
  label: string;
  offsetMs: number;
}

export function Scrubber({
  timeMs,
  totalMs,
  markers,
  onScrub,
  onCommit,
  onDragChange,
  onMarkerClick,
}: {
  timeMs: number;
  totalMs: number;
  markers: ScrubberMarker[];
  /** Visual position while dragging — no seek yet. */
  onScrub(ms: number): void;
  /** The real seek, once per release or click. */
  onCommit(ms: number): void;
  onDragChange(dragging: boolean): void;
  /** A marker was clicked — the player seeks and syncs the lanes. */
  onMarkerClick?(marker: ScrubberMarker): void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const positionToMs = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || totalMs === 0) return 0;
    const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return Math.round(pct * totalMs);
  };

  const playedPct = totalMs > 0 ? Math.min(timeMs / totalMs, 1) * 100 : 0;

  // Marks closer together than the eye can separate are grouped into one
  // tick; hovering it lists what's inside so nothing hides under a
  // neighbour.
  const clusters = useMemo<Cluster[]>(() => {
    if (totalMs <= 0 || markers.length === 0) return [];
    const gap = Math.max(totalMs * 0.015, 300);
    const sorted = [...markers].sort((a, b) => a.offsetMs - b.offsetMs);
    const out: Cluster[] = [];
    for (const marker of sorted) {
      const last = out[out.length - 1];
      const anchor = last?.markers[0];
      if (last && anchor && marker.offsetMs - anchor.offsetMs <= gap) {
        last.markers.push(marker);
      } else {
        out.push({ markers: [marker], offsetMs: marker.offsetMs, hasError: false });
      }
    }
    for (const cluster of out) {
      cluster.offsetMs = Math.round(
        cluster.markers.reduce((sum, m) => sum + m.offsetMs, 0) /
          cluster.markers.length,
      );
      cluster.hasError = cluster.markers.some((m) => m.kind === "error");
    }
    return out;
  }, [markers, totalMs]);

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(totalMs)}
      aria-valuenow={Math.round(Math.min(timeMs, totalMs))}
      aria-valuetext={formatClock(Math.min(timeMs, totalMs))}
      className="group relative flex h-7 min-w-0 flex-1 cursor-pointer touch-none items-center select-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        onDragChange(true);
        onScrub(positionToMs(event.clientX));
      }}
      onPointerMove={(event) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0) {
          setHoverPct(
            Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
          );
        }
        if (dragging) onScrub(positionToMs(event.clientX));
      }}
      onPointerUp={(event) => {
        if (!dragging) return;
        setDragging(false);
        onDragChange(false);
        onCommit(positionToMs(event.clientX));
      }}
      onPointerLeave={() => {
        if (!dragging) setHoverPct(null);
      }}
    >
      <div className="relative h-1 w-full rounded-full bg-raised transition-[height] group-hover:h-1.5">
        <div
          className="bg-amber absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${playedPct}%` }}
        />
      </div>

      {clusters.map((cluster, index) => {
        const left = (cluster.offsetMs / totalMs) * 100;
        const multi = cluster.markers.length > 1;
        return (
          <div
            key={index}
            className="group/mk absolute top-0 bottom-0 z-10 flex w-2 -translate-x-1/2 items-center justify-center"
            style={{ left: `${left}%` }}
          >
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                const first = cluster.markers[0];
                if (!first) return;
                if (onMarkerClick) onMarkerClick(first);
                else onCommit(first.offsetMs);
              }}
              aria-label={`${cluster.markers.length} event${
                multi ? "s" : ""
              } at ${formatClock(cluster.offsetMs)}`}
              className={`h-2.5 rounded-full transition-[height] group-hover/mk:h-3.5 ${
                multi ? "w-1" : "w-0.75"
              } ${cluster.hasError ? "bg-red" : "bg-amber"}`}
            />
            <div className="absolute bottom-full left-1/2 z-30 hidden -translate-x-1/2 pb-2 group-hover/mk:block">
              <div className="max-h-40 w-60 max-w-[70vw] overflow-y-auto rounded-md border border-edge bg-raised p-1">
                {cluster.markers.map((marker) => (
                  <button
                    key={marker.id}
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() =>
                      onMarkerClick
                        ? onMarkerClick(marker)
                        : onCommit(marker.offsetMs)
                    }
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-surface"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        marker.kind === "error" ? "bg-red" : "bg-amber"
                      }`}
                    />
                    <span className="text-faint shrink-0 font-mono text-[11px] tabular-nums">
                      {formatClock(marker.offsetMs)}
                    </span>
                    <span className="truncate text-[12px]">{marker.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <span
        className={`bg-amber pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full transition-opacity ${
          dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ left: `${playedPct}%` }}
        aria-hidden
      />

      {hoverPct !== null && totalMs > 0 ? (
        <span
          className="text-muted pointer-events-none absolute -top-3 -translate-x-1/2 rounded border border-edge bg-raised px-1 font-mono text-[10px] tabular-nums"
          style={{ left: `${hoverPct * 100}%` }}
          aria-hidden
        >
          {formatClock(hoverPct * totalMs)}
        </span>
      ) : null}
    </div>
  );
}
