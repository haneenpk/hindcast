import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NetworkCapture } from "./network";

const ENDPOINT = "http://ingest.example.com";

function okResponse(status: number): Response {
  return { status } as unknown as Response;
}

class FakeXHR {
  status = 0;
  private listeners = new Map<string, Array<() => void>>();

  open(_method: string, _url: string | URL): void {}
  send(_body?: unknown): void {}
  addEventListener(type: string, handler: () => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(handler);
    this.listeners.set(type, existing);
  }
  finish(status: number): void {
    this.status = status;
    for (const handler of this.listeners.get("loadend") ?? []) handler();
  }
}

describe("NetworkCapture", () => {
  let capture: NetworkCapture;
  let realFetch: typeof fetch;
  let realXhr: typeof XMLHttpRequest;

  beforeEach(() => {
    realFetch = window.fetch;
    realXhr = globalThis.XMLHttpRequest;
    capture = new NetworkCapture(ENDPOINT);
  });

  afterEach(() => {
    capture.stop();
    window.fetch = realFetch;
    globalThis.XMLHttpRequest = realXhr;
    vi.restoreAllMocks();
  });

  it("records a fetch outcome with method, url, status and duration", async () => {
    window.fetch = vi.fn().mockResolvedValue(okResponse(200));
    capture.start();

    await window.fetch("/api/products", { method: "post" });

    const [entry] = capture.drain();
    expect(entry).toMatchObject({
      method: "POST",
      url: new URL("/api/products", window.location.href).href,
      status: 200,
    });
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records a failed fetch without a status and keeps the rejection", async () => {
    window.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    capture.start();

    await expect(window.fetch("https://api.down.example.com/x")).rejects.toThrow(
      "Failed to fetch",
    );

    const [entry] = capture.drain();
    expect(entry?.status).toBeUndefined();
    expect(entry?.url).toBe("https://api.down.example.com/x");
  });

  it("never records the recorder's own ingest traffic", async () => {
    window.fetch = vi.fn().mockResolvedValue(okResponse(202));
    capture.start();

    await window.fetch(`${ENDPOINT}/v1/events`, { method: "POST" });

    expect(capture.drain()).toHaveLength(0);
  });

  it("records xhr outcomes via open/send", () => {
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    capture.start();

    const xhr = new FakeXHR();
    xhr.open("get", "/inventory.json");
    xhr.send();
    xhr.finish(500);

    const [entry] = capture.drain();
    expect(entry).toMatchObject({
      method: "GET",
      url: new URL("/inventory.json", window.location.href).href,
      status: 500,
    });
  });

  it("reports xhr status 0 as no status at all", () => {
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    capture.start();

    const xhr = new FakeXHR();
    xhr.open("GET", "https://blocked.example.com/data");
    xhr.send();
    xhr.finish(0);

    const [entry] = capture.drain();
    expect(entry).toBeDefined();
    expect(entry?.status).toBeUndefined();
  });

  it("stops buffering at the cap instead of growing without bound", async () => {
    window.fetch = vi.fn().mockResolvedValue(okResponse(200));
    capture.start();

    await Promise.all(
      Array.from({ length: 220 }, (_, i) => window.fetch(`/api/item-${i}`)),
    );

    expect(capture.drain().length).toBe(200);
  });

  it("stop() hands back the original fetch and xhr methods", () => {
    const stub = vi.fn().mockResolvedValue(okResponse(200));
    window.fetch = stub;
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    const originalOpen = FakeXHR.prototype.open;

    capture.start();
    expect(window.fetch).not.toBe(stub);

    capture.stop();
    expect(window.fetch).toBe(stub);
    expect(FakeXHR.prototype.open).toBe(originalOpen);
  });
});
