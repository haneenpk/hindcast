import type { CapturedError, CapturedErrorSource } from "./types";

const MAX_BUFFERED = 25;
const MAX_MESSAGE = 4000;
const MAX_STACK = 16_000;

function describeArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.message;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

function stackOf(value: unknown): string | undefined {
  return value instanceof Error && typeof value.stack === "string"
    ? value.stack.slice(0, MAX_STACK)
    : undefined;
}

/**
 * Listens on the three places browser errors surface — window "error"
 * events, unhandled promise rejections, and console.error — and buffers
 * them until the next flush. Capped so an error loop can't grow the
 * buffer without bound, and every path swallows its own failures: error
 * reporting that throws would be a bad joke.
 */
export class ErrorCapture {
  private buffer: CapturedError[] = [];
  private originalConsoleError: typeof console.error | null = null;

  private readonly onWindowError = (event: Event): void => {
    try {
      // Resource load failures also fire "error" but carry no message;
      // they belong to network capture, not here.
      if (!(event instanceof ErrorEvent) || !event.message) return;
      this.push("window_error", event.message, stackOf(event.error));
    } catch {
      /* never disturb the page */
    }
  };

  private readonly onRejection = (event: Event): void => {
    try {
      const reason: unknown = (event as PromiseRejectionEvent).reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : describeArg(reason);
      this.push(
        "unhandled_rejection",
        message || "Unhandled promise rejection",
        stackOf(reason),
      );
    } catch {
      /* never disturb the page */
    }
  };

  start(): void {
    try {
      window.addEventListener("error", this.onWindowError);
      window.addEventListener("unhandledrejection", this.onRejection);

      const original = console.error.bind(console);
      this.originalConsoleError = console.error;
      const capture = this;
      console.error = function (...args: unknown[]) {
        try {
          capture.push(
            "console_error",
            args.map(describeArg).join(" "),
            args.map(stackOf).find((stack) => stack !== undefined),
          );
        } catch {
          /* the original call below must still happen */
        }
        return original(...args);
      };
    } catch {
      /* capture stays partial or off; recording continues */
    }
  }

  stop(): void {
    try {
      window.removeEventListener("error", this.onWindowError);
      window.removeEventListener("unhandledrejection", this.onRejection);
      if (this.originalConsoleError) {
        console.error = this.originalConsoleError;
        this.originalConsoleError = null;
      }
    } catch {
      /* teardown is best effort */
    }
  }

  drain(): CapturedError[] {
    if (this.buffer.length === 0) return [];
    const drained = this.buffer;
    this.buffer = [];
    return drained;
  }

  private push(
    source: CapturedErrorSource,
    message: string,
    stack: string | undefined,
  ): void {
    if (this.buffer.length >= MAX_BUFFERED || !message) return;
    const entry: CapturedError = {
      timestamp: Date.now(),
      source,
      message: message.slice(0, MAX_MESSAGE),
    };
    if (stack) entry.stack = stack;
    try {
      entry.url = window.location.href.slice(0, 2048);
    } catch {
      /* no url is fine */
    }
    this.buffer.push(entry);
  }
}
