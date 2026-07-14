import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCapture } from "./errors";

let capture: ErrorCapture;

beforeEach(() => {
  capture = new ErrorCapture();
  capture.start();
});

afterEach(() => {
  capture.stop();
  vi.restoreAllMocks();
});

describe("ErrorCapture", () => {
  it("captures window error events with stack and url", () => {
    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "boom at checkout",
        error: new Error("boom at checkout"),
      }),
    );

    const [entry] = capture.drain();
    expect(entry?.source).toBe("window_error");
    expect(entry?.message).toBe("boom at checkout");
    expect(entry?.stack).toContain("boom at checkout");
    expect(entry?.timestamp).toBeGreaterThan(0);
    expect(entry?.url).toContain("http");
  });

  it("ignores resource-load error events, which carry no message", () => {
    window.dispatchEvent(new Event("error"));
    expect(capture.drain()).toHaveLength(0);
  });

  it("captures unhandled rejections whatever the reason is", () => {
    const withError = new Event("unhandledrejection") as Event & {
      reason: unknown;
    };
    withError.reason = new Error("fetch exploded");
    window.dispatchEvent(withError);

    const withString = new Event("unhandledrejection") as Event & {
      reason: unknown;
    };
    withString.reason = "just a string";
    window.dispatchEvent(withString);

    const drained = capture.drain();
    expect(drained.map((entry) => entry.source)).toEqual([
      "unhandled_rejection",
      "unhandled_rejection",
    ]);
    expect(drained[0]?.message).toBe("fetch exploded");
    expect(drained[0]?.stack).toBeDefined();
    expect(drained[1]?.message).toBe("just a string");
  });

  it("captures console.error and still calls the real one through", () => {
    capture.stop();
    const underlying = vi.fn();
    const original = console.error;
    console.error = underlying;
    capture = new ErrorCapture();
    capture.start();

    console.error("stock check failed for", { slug: "oak-bookshelf" });

    const [entry] = capture.drain();
    expect(entry?.source).toBe("console_error");
    expect(entry?.message).toBe('stock check failed for {"slug":"oak-bookshelf"}');
    expect(underlying).toHaveBeenCalledTimes(1);

    capture.stop();
    expect(console.error).toBe(underlying);
    console.error = original;
  });

  it("caps the buffer so an error loop can't grow it forever", () => {
    for (let i = 0; i < 40; i += 1) {
      window.dispatchEvent(
        new ErrorEvent("error", { message: `overflow ${i}` }),
      );
    }
    expect(capture.drain().length).toBe(25);
  });

  it("drains to empty", () => {
    window.dispatchEvent(new ErrorEvent("error", { message: "once" }));
    expect(capture.drain()).toHaveLength(1);
    expect(capture.drain()).toHaveLength(0);
  });
});
