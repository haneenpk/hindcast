"use client";

import { useEffect, useRef, useState } from "react";
import "rrweb-player/dist/style.css";

type PlayerState = "loading" | "empty" | "error" | "ready";

interface RrwebPlayerInstance {
  pause(): void;
  $destroy(): void;
}

export function SessionPlayer({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RrwebPlayerInstance | null>(null);
  const [state, setState] = useState<PlayerState>("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/events`);
        if (!response.ok) {
          setState(response.status === 404 ? "empty" : "error");
          return;
        }
        const { events } = (await response.json()) as { events: unknown[] };
        if (cancelled || !containerRef.current) return;
        // A replay needs at least a full snapshot and one frame after it.
        if (!Array.isArray(events) || events.length < 2) {
          setState("empty");
          return;
        }

        const { default: Player } = await import("rrweb-player");
        if (cancelled || !containerRef.current) return;
        const width = containerRef.current.clientWidth;
        playerRef.current = new Player({
          target: containerRef.current,
          props: {
            // rrweb-player owns the event type; the stream came out of
            // storage exactly as the recorder produced it.
            events: events as never[],
            width,
            height: Math.round(width * 0.5625),
            autoPlay: false,
            showController: true,
          },
        }) as unknown as RrwebPlayerInstance;
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      try {
        playerRef.current?.pause();
        playerRef.current?.$destroy();
      } catch {
        /* replayer teardown mid-load */
      }
      playerRef.current = null;
    };
  }, [sessionId]);

  return (
    <div>
      {state === "loading" ? (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-edge bg-surface">
          <span className="text-faint text-[13px]">Loading session…</span>
        </div>
      ) : null}
      {state === "empty" ? (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-edge bg-surface">
          <span className="text-muted text-[13px]">
            Not enough recorded events to replay this session.
          </span>
        </div>
      ) : null}
      {state === "error" ? (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-edge bg-surface">
          <span className="text-red text-[13px]">
            Couldn&apos;t load the recording.
          </span>
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={state === "ready" ? "player-frame" : "hidden"}
      />
    </div>
  );
}
