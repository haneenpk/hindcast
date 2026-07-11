import { describe, expect, it } from "vitest";
import type { eventWithTime } from "@rrweb/types";
import { EventBuffer } from "./buffer";

function fakeEvent(padding = ""): eventWithTime {
  return { type: 3, data: { padding }, timestamp: 1 } as unknown as eventWithTime;
}

describe("EventBuffer", () => {
  it("accumulates events until drained", () => {
    const buffer = new EventBuffer();
    buffer.push(fakeEvent());
    buffer.push(fakeEvent());
    expect(buffer.length).toBe(2);

    const drained = buffer.drain();
    expect(drained).toHaveLength(2);
    expect(buffer.length).toBe(0);
    expect(buffer.drain()).toHaveLength(0);
  });

  it("asks for a flush once the size cap is hit", () => {
    const buffer = new EventBuffer(200);
    expect(buffer.push(fakeEvent("x".repeat(50)))).toBe(false);
    expect(buffer.push(fakeEvent("x".repeat(200)))).toBe(true);
  });

  it("keeps accepting events after the cap until someone drains", () => {
    const buffer = new EventBuffer(10);
    buffer.push(fakeEvent("x".repeat(50)));
    buffer.push(fakeEvent());
    expect(buffer.length).toBe(2);
  });
});
