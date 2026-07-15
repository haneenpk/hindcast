"use client";

import { useEffect, useRef, useState } from "react";
import "@rrweb/replay/dist/style.css";

// Built straight on @rrweb/replay: the rrweb-player UI package (2.1.0)
// ships a dist whose onMount never constructs its replayer, so sessions
// mounted through it render an empty shell. The engine itself is fine.

type PlayerState = "loading" | "empty" | "error" | "ready";

interface ReplayerLike {
  play(offsetMs?: number): void;
  pause(offsetMs?: number): void;
  getCurrentTime(): number;
  getMetaData(): { startTime: number; totalTime: number };
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

export function SessionPlayer({
  sessionId,
  markers = [],
}: {
  sessionId: string;
  markers?: TimelineMarker[];
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<ReplayerLike | null>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [startTime, setStartTime] = useState(0);

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

        replayer.pause(0); // render the first frame instead of a blank stage
        const replayMeta = replayer.getMetaData();
        setTotalMs(replayMeta.totalTime);
        setStartTime(replayMeta.startTime);
        replayer.on("finish", () => {
          setPlaying(false);
          setFinished(true);
        });

        const tick = () => {
          const current = replayerRef.current;
          if (current) {
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
    if (playing) {
      replayer.play(ms);
    } else {
      replayer.pause(ms);
    }
    setFinished(false);
    setTimeMs(ms);
  };

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
        <div
          ref={stageRef}
          className="session-stage overflow-hidden rounded-t-lg border border-b-0 border-edge bg-surface"
        />
        <div className="flex items-center gap-3 rounded-b-lg border border-edge bg-surface px-3 py-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-raised"
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
          <span className="text-muted w-12 text-right font-mono text-xs tabular-nums">
            {formatClock(Math.min(timeMs, totalMs))}
          </span>
          <div className="relative flex h-7 min-w-0 flex-1 items-end">
            {totalMs > 0
              ? markers.map((marker) => {
                  const offset = Math.min(
                    Math.max(marker.timestamp - startTime, 0),
                    totalMs,
                  );
                  return (
                    <button
                      key={marker.id}
                      type="button"
                      onClick={() => seek(offset)}
                      title={`${formatClock(offset)} · ${marker.label}`}
                      aria-label={`Jump to ${marker.kind} at ${formatClock(offset)}`}
                      className={`absolute top-0.5 h-2 w-0.75 -translate-x-1/2 rounded-full transition-[height] hover:h-3 ${
                        marker.kind === "error" ? "bg-red" : "bg-amber"
                      }`}
                      style={{ left: `${(offset / totalMs) * 100}%` }}
                    />
                  );
                })
              : null}
            <input
              type="range"
              min={0}
              max={Math.max(totalMs, 1)}
              value={Math.min(timeMs, totalMs)}
              onChange={(event) => seek(Number(event.target.value))}
              className="accent-amber mb-1 h-1 w-full"
              aria-label="Seek"
            />
          </div>
          <span className="text-faint w-12 font-mono text-xs tabular-nums">
            {formatClock(totalMs)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
