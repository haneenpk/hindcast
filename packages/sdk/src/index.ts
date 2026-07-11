import { EventBuffer } from "./buffer";
import { debugLog, resolveConfig } from "./config";
import type { HindcastConfig } from "./config";
import { startRecorder } from "./recorder";
import { openSession } from "./session";
import { sendBatch } from "./transport";
import type { EventBatch } from "./types";

interface ActiveRecording {
  stopRecorder(): void;
  flushTimer: number;
  onVisibilityChange(): void;
  onPageHide(): void;
  flush(unloading: boolean): void;
}

let active: ActiveRecording | null = null;

/**
 * Everything below is wrapped: whatever breaks inside the SDK, the host
 * page must never notice. Failure makes the recorder go quiet, not loud.
 */
export function init(config: HindcastConfig): void {
  try {
    if (active) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const resolved = resolveConfig(config);
    if (!resolved) return;

    const session = openSession();
    const buffer = new EventBuffer();

    const flush = (unloading: boolean): void => {
      try {
        const events = buffer.drain();
        if (events.length === 0) return;
        const batch: EventBatch = {
          v: 1,
          key: resolved.key,
          sessionId: session.id,
          seq: session.nextSeq(),
          startedAt: session.startedAt,
          url: window.location.href,
          events,
        };
        debugLog(resolved, `flush #${batch.seq}:`, events.length, "events");
        sendBatch(resolved, batch, unloading);
      } catch {
        /* dropping a batch beats surfacing an error on the host page */
      }
    };

    const stopRecorder = startRecorder((event) => {
      if (buffer.push(event)) flush(false);
    });
    if (!stopRecorder) return;

    const flushTimer = window.setInterval(() => flush(false), resolved.flushIntervalMs);
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") flush(true);
    };
    // Older Safari skips visibilitychange on navigation; pagehide covers it.
    // Flushing twice is harmless — the second drain finds an empty buffer.
    const onPageHide = (): void => flush(true);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    debugLog(resolved, "recording session", session.id);
    active = { stopRecorder, flushTimer, onVisibilityChange, onPageHide, flush };
  } catch {
    active = null;
  }
}

/** Runtime kill switch: stops recording and ships what's still buffered. */
export function stop(): void {
  try {
    if (!active) return;
    const current = active;
    active = null;
    window.clearInterval(current.flushTimer);
    document.removeEventListener("visibilitychange", current.onVisibilityChange);
    window.removeEventListener("pagehide", current.onPageHide);
    current.stopRecorder();
    current.flush(false);
  } catch {
    /* even teardown stays silent */
  }
}

export type { HindcastConfig } from "./config";
export type { EventBatch } from "./types";
