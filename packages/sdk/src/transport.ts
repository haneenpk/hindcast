import type { ResolvedConfig } from "./config";
import type { EventBatch } from "./types";

/**
 * Batches travel as text/plain JSON on purpose: an application/json body
 * would force a CORS preflight that sendBeacon can't participate in, and
 * it keeps the fetch path a "simple" request too. The ingest API parses
 * the raw body no matter the content type.
 */
export function sendBatch(
  config: ResolvedConfig,
  batch: EventBatch,
  unloading: boolean,
): void {
  let body: string;
  try {
    body = JSON.stringify(batch);
  } catch {
    return;
  }
  const url = `${config.endpoint}/v1/events`;

  if (unloading) {
    // sendBeacon survives the page going away but has a small quota; a
    // refused beacon falls through to keepalive fetch as a best effort.
    try {
      if (
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))
      ) {
        return;
      }
    } catch {
      /* fall through */
    }
  }

  try {
    void fetch(url, {
      method: "POST",
      body,
      credentials: "omit",
      keepalive: unloading,
    }).catch(() => {
      /* ingest being down is not the host page's problem */
    });
  } catch {
    /* fetch itself missing or blocked — nothing sensible left to try */
  }
}
