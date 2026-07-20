import { describe, expect, it } from "vitest";
import { init, report, stop } from "./index";

// The one promise the SDK makes to host pages: calling it can never throw.
describe("init", () => {
  it("is a no-op for garbage config and never throws", () => {
    expect(() => init({} as never)).not.toThrow();
    expect(() => init({ key: "", endpoint: "" })).not.toThrow();
    expect(() => init({ key: "k", endpoint: "not-a-url" })).not.toThrow();
  });

  it("respects the kill switch", () => {
    expect(() =>
      init({ key: "k", endpoint: "http://localhost:9", enabled: false }),
    ).not.toThrow();
  });

  it("stop() is safe to call without a running recorder", () => {
    expect(() => stop()).not.toThrow();
    expect(() => stop()).not.toThrow();
  });

  it("report() before init is a silent no-op", () => {
    expect(() => report()).not.toThrow();
    expect(() => report("nothing is running yet")).not.toThrow();
  });
});
