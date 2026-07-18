"use client";

import { useRef, useState } from "react";
import { formatClock } from "@/lib/format";

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
}: {
  timeMs: number;
  totalMs: number;
  markers: ScrubberMarker[];
  /** Visual position while dragging — no seek yet. */
  onScrub(ms: number): void;
  /** The real seek, once per release or click. */
  onCommit(ms: number): void;
  onDragChange(dragging: boolean): void;
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

      {markers.map((marker) => (
        <button
          key={marker.id}
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onCommit(marker.offsetMs)}
          title={`${formatClock(marker.offsetMs)} · ${marker.label}`}
          aria-label={`Jump to ${marker.kind} at ${formatClock(marker.offsetMs)}`}
          className={`absolute top-1 h-2 w-0.75 -translate-x-1/2 rounded-full transition-[height] hover:h-3 ${
            marker.kind === "error" ? "bg-red" : "bg-amber"
          }`}
          style={{
            left: `${totalMs > 0 ? (marker.offsetMs / totalMs) * 100 : 0}%`,
          }}
        />
      ))}

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
