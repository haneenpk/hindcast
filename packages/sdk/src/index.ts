import { EventBuffer } from "./buffer";
import { debugLog, resolveConfig } from "./config";
import type { HindcastConfig } from "./config";
import { ErrorCapture } from "./errors";
import { NetworkCapture } from "./network";
import { startRecorder } from "./recorder";
import { openSession } from "./session";
import { sendBatch, sendReport } from "./transport";
import type { EventBatch } from "./types";
import { createReportWidget } from "./widget";
import type { ReportWidget } from "./widget";

interface ActiveRecording {
  stopRecorder(): void;
  errorCapture: ErrorCapture;
  networkCapture: NetworkCapture;
  widget: ReportWidget | null;
  flushTimer: number;
  onVisibilityChange(): void;
  onPageHide(): void;
  flush(unloading: boolean): void;
}

let active: ActiveRecording | null = null;
let activeReporter: ((comment?: string) => void) | null = null;

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
    const errorCapture = new ErrorCapture();
    const networkCapture = new NetworkCapture(resolved.endpoint);

    const flush = (unloading: boolean): void => {
      try {
        const events = buffer.drain();
        const errors = errorCapture.drain();
        const network = networkCapture.drain();
        if (events.length === 0 && errors.length === 0 && network.length === 0)
          return;
        const batch: EventBatch = {
          v: 1,
          key: resolved.key,
          sessionId: session.id,
          seq: session.nextSeq(),
          startedAt: session.startedAt,
          url: window.location.href,
          events,
        };
        if (errors.length > 0) batch.errors = errors;
        if (network.length > 0) batch.network = network;
        debugLog(
          resolved,
          `flush #${batch.seq}:`,
          events.length,
          "events,",
          errors.length,
          "errors,",
          network.length,
          "requests",
        );
        sendBatch(resolved, batch, unloading);
      } catch {
        /* dropping a batch beats surfacing an error on the host page */
      }
    };

    const stopRecorder = startRecorder((event) => {
      if (buffer.push(event)) flush(false);
    });
    if (!stopRecorder) return;
    errorCapture.start();
    networkCapture.start();

    const flushTimer = window.setInterval(() => flush(false), resolved.flushIntervalMs);
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") flush(true);
    };
    // Older Safari skips visibilitychange on navigation; pagehide covers it.
    // Flushing twice is harmless — the second drain finds an empty buffer.
    const onPageHide = (): void => flush(true);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    const submitReport = (comment?: string): void => {
      try {
        flush(false); // the story so far should arrive with the flag
        sendReport(resolved, {
          v: 1,
          key: resolved.key,
          sessionId: session.id,
          startedAt: session.startedAt,
          url: window.location.href,
          comment: comment?.trim() || undefined,
        });
        debugLog(resolved, "session reported");
      } catch {
        /* a lost report must not take the page with it */
      }
    };
    activeReporter = submitReport;

    let widget: ReportWidget | null = null;
    if (resolved.reportButton) {
      widget = createReportWidget({
        onSubmit: (comment) => submitReport(comment),
      });
      if (widget) {
        const element = widget.element;
        if (document.body) {
          document.body.appendChild(element);
        } else {
          document.addEventListener(
            "DOMContentLoaded",
            () => {
              try {
                document.body?.appendChild(element);
              } catch {
                /* no body, no button */
              }
            },
            { once: true },
          );
        }
      }
    }

    debugLog(resolved, "recording session", session.id);
    active = {
      stopRecorder,
      errorCapture,
      networkCapture,
      widget,
      flushTimer,
      onVisibilityChange,
      onPageHide,
      flush,
    };
  } catch {
    active = null;
    activeReporter = null;
  }
}

/**
 * Flags the current session, with the visitor's words if given. Safe to
 * call any time — before init() or after stop() it does nothing.
 */
export function report(comment?: string): void {
  try {
    activeReporter?.(comment);
  } catch {
    /* never the host page's problem */
  }
}

/** Runtime kill switch: stops recording and ships what's still buffered. */
export function stop(): void {
  try {
    if (!active) return;
    const current = active;
    active = null;
    activeReporter = null;
    window.clearInterval(current.flushTimer);
    document.removeEventListener("visibilitychange", current.onVisibilityChange);
    window.removeEventListener("pagehide", current.onPageHide);
    current.stopRecorder();
    current.errorCapture.stop();
    current.networkCapture.stop();
    current.widget?.destroy();
    current.flush(false);
  } catch {
    /* even teardown stays silent */
  }
}

export type { HindcastConfig } from "./config";
export type { EventBatch } from "./types";
