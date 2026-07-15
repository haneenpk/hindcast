import type { CapturedRequest } from "./types";

const MAX_BUFFERED = 200;
const MAX_URL = 2048;
const MAX_METHOD = 16;

/**
 * Wraps fetch and XMLHttpRequest to record request outcomes: method, url,
 * status and duration. Never bodies and never headers — outcomes are
 * enough to debug with, and payloads are exactly what a privacy-first
 * recorder must not hoard. Traffic to the SDK's own ingest endpoint is
 * skipped, or the recorder would record itself forever.
 */
export class NetworkCapture {
  private buffer: CapturedRequest[] = [];
  private originalFetch: typeof fetch | null = null;
  private originalOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalSend: typeof XMLHttpRequest.prototype.send | null = null;
  private readonly xhrMeta = new WeakMap<
    XMLHttpRequest,
    { method: string; url: string }
  >();

  constructor(private readonly ownEndpoint: string) {}

  start(): void {
    this.wrapFetch();
    this.wrapXhr();
  }

  stop(): void {
    try {
      if (this.originalFetch) {
        window.fetch = this.originalFetch;
        this.originalFetch = null;
      }
      if (this.originalOpen) {
        XMLHttpRequest.prototype.open = this.originalOpen;
        this.originalOpen = null;
      }
      if (this.originalSend) {
        XMLHttpRequest.prototype.send = this.originalSend;
        this.originalSend = null;
      }
    } catch {
      /* teardown is best effort */
    }
  }

  drain(): CapturedRequest[] {
    if (this.buffer.length === 0) return [];
    const drained = this.buffer;
    this.buffer = [];
    return drained;
  }

  private wrapFetch(): void {
    try {
      if (typeof window.fetch !== "function") return;
      const original = window.fetch;
      this.originalFetch = original;
      const capture = this;

      window.fetch = function (
        this: unknown,
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> {
        const startedAt = Date.now();
        let method = "GET";
        let url = "";
        try {
          if (typeof input === "string") {
            url = input;
          } else if (input instanceof URL) {
            url = input.href;
          } else if (input && typeof input.url === "string") {
            url = input.url;
            if (input.method) method = input.method;
          }
          if (init?.method) method = init.method;
        } catch {
          /* an unreadable input still gets fetched below */
        }

        const result = original.call(window, input as RequestInfo, init);
        try {
          // A second .then branch with its own rejection handler: the
          // caller's promise keeps its rejection, nothing fires twice.
          void result.then(
            (response) => capture.push(startedAt, method, url, response.status),
            () => capture.push(startedAt, method, url, undefined),
          );
        } catch {
          /* recording must never affect the request */
        }
        return result;
      };
    } catch {
      /* fetch stays untouched; xhr capture may still work */
    }
  }

  private wrapXhr(): void {
    try {
      if (typeof XMLHttpRequest === "undefined") return;
      const proto = XMLHttpRequest.prototype;
      const originalOpen = proto.open;
      const originalSend = proto.send;
      this.originalOpen = originalOpen;
      this.originalSend = originalSend;
      const capture = this;

      proto.open = function (
        this: XMLHttpRequest,
        ...args: Parameters<typeof originalOpen>
      ) {
        try {
          capture.xhrMeta.set(this, {
            method: String(args[0] || "GET"),
            url: String(args[1]),
          });
        } catch {
          /* an unrecorded xhr still works */
        }
        return originalOpen.apply(this, args);
      } as typeof proto.open;

      proto.send = function (
        this: XMLHttpRequest,
        ...args: Parameters<typeof originalSend>
      ) {
        const startedAt = Date.now();
        try {
          this.addEventListener("loadend", () => {
            const meta = capture.xhrMeta.get(this);
            if (!meta) return;
            // status 0 means the request never got an answer (network
            // down, CORS, abort) — recorded without a status.
            capture.push(startedAt, meta.method, meta.url, this.status || undefined);
          });
        } catch {
          /* recording must never affect the request */
        }
        return originalSend.apply(this, args);
      };
    } catch {
      /* xhr stays untouched */
    }
  }

  private push(
    startedAt: number,
    method: string,
    url: string,
    status: number | undefined,
  ): void {
    try {
      if (this.buffer.length >= MAX_BUFFERED) return;
      const resolved = resolveUrl(url);
      if (!resolved || resolved.startsWith(this.ownEndpoint)) return;
      const entry: CapturedRequest = {
        timestamp: startedAt,
        method: method.toUpperCase().slice(0, MAX_METHOD),
        url: resolved.slice(0, MAX_URL),
        durationMs: Math.max(0, Date.now() - startedAt),
      };
      if (typeof status === "number" && status > 0) entry.status = status;
      this.buffer.push(entry);
    } catch {
      /* a dropped entry beats a broken page */
    }
  }
}

function resolveUrl(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return String(url).slice(0, MAX_URL);
  }
}
