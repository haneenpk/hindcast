import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openSession } from "./session";

describe("openSession", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("continues the same session across reloads in a tab", () => {
    const first = openSession();
    const second = openSession();
    expect(second.id).toBe(first.id);
    expect(second.startedAt).toBe(first.startedAt);
  });

  it("hands out session ids that look like uuids", () => {
    expect(openSession().id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("never reuses a chunk seq after a reload", () => {
    const beforeReload = openSession();
    expect(beforeReload.nextSeq()).toBe(0);
    expect(beforeReload.nextSeq()).toBe(1);

    const afterReload = openSession();
    expect(afterReload.nextSeq()).toBe(2);
  });

  it("still works when sessionStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    const session = openSession();
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.nextSeq()).toBe(0);
    expect(session.nextSeq()).toBe(1);
  });
});
