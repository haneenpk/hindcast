"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format";
import { Scrubber } from "./scrubber";
import { SessionLanes } from "./session-lanes";
import type { ConsoleEntry, NetworkEntry } from "./session-lanes";
import "@rrweb/replay/dist/style.css";

// Built straight on @rrweb/replay: the rrweb-player UI package (2.1.0)
// ships a dist whose onMount never constructs its replayer, so sessions
// mounted through it render an empty shell. The engine itself is fine.

type PlayerState = "loading" | "empty" | "error" | "ready";
type Speed = 1 | 2 | 4;

interface ReplayerLike {
  play(offsetMs?: number): void;
  pause(offsetMs?: number): void;
  getCurrentTime(): number;
  getMetaData(): { startTime: number; totalTime: number };
  setConfig(config: { speed?: number; skipInactive?: boolean }): void;
  on(event: string, handler: () => void): void;
}

interface RecordedEvent {
  type: number;
  data?: { width?: number; height?: number };
}

export interface TimelineMarker {
  id: string;
  kind: "error" | "network";
  timestamp: number;
  label: string;
}

const NEXT_SPEED: Record<Speed, Speed> = { 1: 2, 2: 4, 4: 1 };

export function SessionPlayer({
  sessionId,
  markers = [],
  consoleEntries = [],
  networkEntries = [],
}: {
  sessionId: string;
  markers?: TimelineMarker[];
  consoleEntries?: ConsoleEntry[];
  networkEntries?: NetworkEntry[];
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<ReplayerLike | null>(null);
  const scrubbingRef = useRef(false);
  const [state, setState] = useState<PlayerState>("loading");
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [skipInactive, setSkipInactive] = useState(false);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const stage = stageRef.current;

    (async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/events`);
        if (!response.ok) {
          setState(response.status === 404 ? "empty" : "error");
          return;
        }
        const { events } = (await response.json()) as {
          events: RecordedEvent[];
        };
        if (cancelled || !stage) return;
        if (!Array.isArray(events) || events.length < 2) {
          setState("empty");
          return;
        }

        const { Replayer } = await import("@rrweb/replay");
        if (cancelled || !stage) return;

        const replayer = new Replayer(events as never[], {
          root: stage,
          showWarning: false,
          // Defaults to true: replaying a recorded focus event calls real
          // .focus(), which steals the viewer's keyboard into the replayed
          // input — you could type into the footage without clicking.
          triggerFocus: false,
        }) as unknown as ReplayerLike;
        replayerRef.current = replayer;

        // Scale the recorded viewport down into the stage.
        const meta = events.find((event) => event.type === 4);
        const recordedWidth = meta?.data?.width ?? 1024;
        const recordedHeight = meta?.data?.height ?? 576;
        const width = wrapperRef.current?.clientWidth ?? 848;
        const scale = Math.min(width / recordedWidth, 1);
        stage.style.height = `${Math.round(recordedHeight * scale)}px`;
        const replayerWrapper =
          stage.querySelector<HTMLElement>(".replayer-wrapper");
        if (replayerWrapper) {
          replayerWrapper.style.transform = `scale(${scale})`;
        }
        // pointer-events: none stops the mouse; inert also stops keyboard
        // focus from tabbing into the replayed document.
        stage.querySelector("iframe")?.setAttribute("inert", "");

        replayer.pause(0); // render the first frame instead of a blank stage
        const replayMeta = replayer.getMetaData();
        setTotalMs(replayMeta.totalTime);
        setStartTime(replayMeta.startTime);
        replayer.on("finish", () => {
          setPlaying(false);
          setFinished(true);
        });
        replayer.on("skip-start", () => setSkipping(true));
        replayer.on("skip-end", () => setSkipping(false));

        const tick = () => {
          const current = replayerRef.current;
          if (current && !scrubbingRef.current) {
            setTimeMs((previous) => {
              const now = current.getCurrentTime();
              return Number.isFinite(now) ? Math.max(0, now) : previous;
            });
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      try {
        replayerRef.current?.pause();
      } catch {
        /* tearing down mid-load */
      }
      replayerRef.current = null;
      if (stage) stage.innerHTML = "";
    };
  }, [sessionId]);

  const toggle = () => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    if (playing) {
      replayer.pause();
      setPlaying(false);
      return;
    }
    if (finished) {
      replayer.play(0);
      setFinished(false);
    } else {
      replayer.play(replayer.getCurrentTime());
    }
    setPlaying(true);
  };

  const seek = (ms: number) => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    const clamped = Math.min(Math.max(ms, 0), totalMs);
    if (playing) {
      replayer.play(clamped);
    } else {
      replayer.pause(clamped);
    }
    setFinished(false);
    setTimeMs(clamped);
  };

  const cycleSpeed = () => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    const next = NEXT_SPEED[speed];
    setSpeed(next);
    replayer.setConfig({ speed: next });
    // A running timer keeps its old speed; restart it from here.
    if (playing) replayer.play(replayer.getCurrentTime());
  };

  const toggleSkipInactive = () => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    const next = !skipInactive;
    setSkipInactive(next);
    replayer.setConfig({ skipInactive: next });
    if (playing) replayer.play(replayer.getCurrentTime());
  };

  // Keyboard transport, kept fresh via a ref so listeners never go stale.
  const transportRef = useRef({ toggle, seek, timeMs });
  transportRef.current = { toggle, seek, timeMs };

  useEffect(() => {
    if (state !== "ready") return;
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [contenteditable], aside")) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        transportRef.current.toggle();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        transportRef.current.seek(transportRef.current.timeMs - 5000);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        transportRef.current.seek(transportRef.current.timeMs + 5000);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  const scrubberMarkers =
    totalMs > 0
      ? markers.map((marker) => ({
          id: marker.id,
          kind: marker.kind,
          label: marker.label,
          offsetMs: Math.min(
            Math.max(marker.timestamp - startTime, 0),
            totalMs,
          ),
        }))
      : [];

  return (
    <div ref={wrapperRef}>
      {state !== "ready" ? (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-edge bg-surface">
          {state === "loading" ? (
            <span className="text-faint text-[13px]">Loading session…</span>
          ) : state === "empty" ? (
            <span className="text-muted text-[13px]">
              Not enough recorded events to replay this session.
            </span>
          ) : (
            <span className="text-red text-[13px]">
              Couldn&apos;t load the recording.
            </span>
          )}
        </div>
      ) : null}

      <div className={state === "ready" ? "" : "invisible h-0 overflow-hidden"}>
        <div className="relative">
          <div
            ref={stageRef}
            onClick={toggle}
            className="session-stage cursor-pointer overflow-hidden rounded-t-lg border border-b-0 border-edge bg-surface"
          />
          {skipping ? (
            <span className="text-amber absolute top-2.5 right-2.5 rounded bg-black/70 px-2 py-0.5 text-[11px] tracking-wide uppercase">
              skipping idle
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3 rounded-b-lg border border-edge bg-surface px-3 py-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-raised"
          >
            {playing ? (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                <rect x="3" y="2" width="3.5" height="12" fill="currentColor" />
                <rect x="9.5" y="2" width="3.5" height="12" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                <path d="M4 2v12l10-6z" fill="currentColor" />
              </svg>
            )}
          </button>

          <span className="text-muted w-12 shrink-0 text-right font-mono text-xs tabular-nums">
            {formatClock(Math.min(timeMs, totalMs))}
          </span>

          <Scrubber
            timeMs={timeMs}
            totalMs={totalMs}
            markers={scrubberMarkers}
            onScrub={(ms) => setTimeMs(ms)}
            onCommit={seek}
            onDragChange={(dragging) => {
              scrubbingRef.current = dragging;
            }}
          />

          <span className="text-faint w-12 shrink-0 font-mono text-xs tabular-nums">
            {formatClock(totalMs)}
          </span>

          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${speed}x`}
            title="Playback speed"
            className="text-muted w-8 shrink-0 rounded-md px-1 py-1 text-center font-mono text-xs transition-colors hover:bg-raised hover:text-fg"
          >
            {speed}×
          </button>

          <button
            type="button"
            onClick={toggleSkipInactive}
            aria-pressed={skipInactive}
            title="Fast-forward through idle stretches"
            className={`shrink-0 rounded-md border px-2 py-1 text-[11px] tracking-wide uppercase transition-colors ${
              skipInactive
                ? "border-amber/50 text-amber"
                : "border-edge text-muted hover:text-fg"
            }`}
          >
            skip idle
          </button>
        </div>

        <SessionLanes
          consoleEntries={consoleEntries}
          networkEntries={networkEntries}
          startTime={startTime}
          totalMs={totalMs}
          onJump={seek}
        />
      </div>
    </div>
  );
}
