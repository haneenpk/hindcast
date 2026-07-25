import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackRoutes } from "./route";

describe("trackRoutes", () => {
  beforeEach(() => {
    history.replaceState({}, "", "/start");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fires on pushState and restores the original after stop", () => {
    const onChange = vi.fn();
    const tracker = trackRoutes(onChange);

    history.pushState({}, "", "/products/desk");
    expect(onChange).toHaveBeenCalledTimes(1);

    history.pushState({}, "", "/cart");
    expect(onChange).toHaveBeenCalledTimes(2);

    tracker.stop();
    history.pushState({}, "", "/checkout");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("ignores navigations that don't change the address", () => {
    const onChange = vi.fn();
    const tracker = trackRoutes(onChange);

    history.pushState({}, "", "/same");
    history.pushState({}, "", "/same");
    expect(onChange).toHaveBeenCalledTimes(1);

    tracker.stop();
  });

  it("fires on back/forward navigation", () => {
    const onChange = vi.fn();
    const tracker = trackRoutes(onChange);

    history.pushState({}, "", "/next");
    onChange.mockClear();

    history.replaceState({}, "", "/prev");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onChange).toHaveBeenCalled();

    tracker.stop();
  });

  it("still returns a tracker when history is hostile", () => {
    const tracker = trackRoutes(() => {
      throw new Error("handler blew up");
    });
    // A throwing handler must not escape into the app's navigation.
    expect(() => history.pushState({}, "", "/boom")).not.toThrow();
    tracker.stop();
  });
});
