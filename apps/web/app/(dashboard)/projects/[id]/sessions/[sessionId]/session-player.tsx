"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format";
import { Scrubber } from "./scrubber";
import type { ScrubberMarker } from "./scrubber";
import { SessionLanes } from "./session-lanes";
import type { ConsoleEntry, LaneFocus, NetworkEntry } from "./session-lanes";
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
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<ReplayerLike | null>(null);
  const scrubbingRef = useRef(false);
  const recWRef = useRef(1024);
  const recHRef = useRef(576);
  const [state, setState] = useState<PlayerState>("loading");
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [skipInactive, setSkipInactive] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [laneFocus, setLaneFocus] = useState<LaneFocus | null>(null);

  // Fits the recorded viewport into whatever space the stage has right
  // now — recomputed on mount, on resize, and when fullscreen flips, so
  // the replay never sits scaled to a stale width.
  const rescale = (): void => {
    const stage = stageRef.current;
    const wrapper = stage?.querySelector<HTMLElement>(".replayer-wrapper");
    const recW = recWRef.current;
    const recH = recHRef.current;
    if (!stage || !wrapper || !recW || !recH) return;

    const isFs = document.fullscreenElement === shellRef.current;
    let scale: number;
    if (isFs) {
      const controlsH = controlsRef.current?.offsetHeight ?? 44;
      scale = Math.min(
        window.innerWidth / recW,
        (window.innerHeight - controlsH) / recH,
      );
      stage.style.width = `${Math.round(recW * scale)}px`;
    } else {
      const availW = wrapperRef.current?.clientWidth ?? 848;
      scale = Math.min(availW / recW, 1);
      stage.style.width = "";
    }
    stage.style.height = `${Math.round(recH * scale)}px`;
    wrapper.style.transform = `scale(${scale})`;
  };

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

        const meta = events.find((event) => event.type === 4);
        recWRef.current = meta?.data?.width ?? 1024;
        recHRef.current = meta?.data?.height ?? 576;
        rescale();
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

  // Keep the replay fitted as the window resizes and as fullscreen flips.
  useEffect(() => {
    if (state !== "ready") return;
    let raf = 0;
    const schedule = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(rescale);
    };
    const onFullscreen = (): void => {
      setFullscreen(document.fullscreenElement === shellRef.current);
      schedule();
    };
    const observer = new ResizeObserver(schedule);
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    window.addEventListener("resize", schedule);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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

  const toggleFullscreen = () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        void document.exitFullscreen();
      } else {
        void el.requestFullscreen();
      }
    } catch {
      /* fullscreen can be blocked by policy; nothing to do */
    }
  };

  // Keyboard transport, kept fresh via a ref so listeners never go stale.
  const transportRef = useRef({ toggle, seek, toggleFullscreen, timeMs });
  transportRef.current = { toggle, seek, toggleFullscreen, timeMs };

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
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        transportRef.current.toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  const onMarkerClick = (marker: ScrubberMarker): void => {
    seek(marker.offsetMs);
    setLaneFocus({ id: marker.id, kind: marker.kind, nonce: performance.now() });
  };

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
            <span className="text-faint animate-pulse text-[13px]">
              Loading session…
            </span>
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
        <div ref={shellRef} className="player-shell">
          <div className="stage-wrap relative">
            <div
              ref={stageRef}
              onClick={toggle}
              className="session-stage cursor-pointer overflow-hidden rounded-t-lg border border-b-0 border-edge bg-surface"
            />
            {skipping ? (
              <span className="text-amber pointer-events-none absolute top-2.5 right-2.5 rounded bg-black/70 px-2 py-0.5 text-[11px] tracking-wide uppercase">
                skipping idle
              </span>
            ) : null}
          </div>

          <div
            ref={controlsRef}
            className="player-controls flex items-center gap-2.5 rounded-b-lg border border-edge bg-surface px-3 py-1.5"
          >
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
              onMarkerClick={onMarkerClick}
              onDragChange={(dragging) => {
                scrubbingRef.current = dragging;
              }}
            />

            <span className="text-faint w-12 shrink-0 font-mono text-xs tabular-nums">
              {formatClock(totalMs)}
            </span>

            <div className="bg-edge h-4 w-px shrink-0" aria-hidden />

            <button
              type="button"
              onClick={cycleSpeed}
              aria-label={`Playback speed ${speed}x`}
              title="Playback speed"
              className="text-muted w-8 shrink-0 rounded-md py-1 text-center font-mono text-xs transition-colors hover:bg-raised hover:text-fg"
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

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              title="Fullscreen (F)"
              className="text-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-raised hover:text-fg"
            >
              {fullscreen ? (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                  <path
                    d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                  <path
                    d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <SessionLanes
          consoleEntries={consoleEntries}
          networkEntries={networkEntries}
          startTime={startTime}
          totalMs={totalMs}
          onJump={seek}
          focus={laneFocus}
        />
      </div>
    </div>
  );
}
