import { describe, expect, it } from "vitest";
import {
  buildMaskInputFn,
  isAlwaysMasked,
  isUnmaskAllowed,
  maskText,
  PRIVATE_BLOCK_SELECTOR,
  UNMASK_ATTRIBUTE,
} from "./masking";

function input(attrs: Record<string, string> = {}): HTMLInputElement {
  const element = document.createElement("input");
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  document.body.appendChild(element);
  return element;
}

describe("isAlwaysMasked", () => {
  it("catches password fields", () => {
    expect(isAlwaysMasked(input({ type: "password" }))).toBe(true);
  });

  it("catches every cc-* autocomplete", () => {
    for (const value of ["cc-number", "cc-exp", "cc-csc", "cc-name"]) {
      expect(isAlwaysMasked(input({ autocomplete: value }))).toBe(true);
    }
  });

  it("catches password managers' autocomplete values", () => {
    expect(isAlwaysMasked(input({ autocomplete: "new-password" }))).toBe(true);
    expect(isAlwaysMasked(input({ autocomplete: "current-password" }))).toBe(true);
    expect(isAlwaysMasked(input({ autocomplete: "one-time-code" }))).toBe(true);
  });

  it("catches card-shaped names and ids", () => {
    expect(isAlwaysMasked(input({ name: "cardNumber" }))).toBe(true);
    expect(isAlwaysMasked(input({ name: "cvv" }))).toBe(true);
    expect(isAlwaysMasked(input({ id: "cc-exp" }))).toBe(true);
    expect(isAlwaysMasked(input({ name: "security_code" }))).toBe(true);
    expect(isAlwaysMasked(input({ name: "pan" }))).toBe(true);
  });

  it("prefers false positives over false negatives", () => {
    // "cardigan-color" is harmless but matches the card pattern — masking
    // it costs nothing, so that is the correct outcome.
    expect(isAlwaysMasked(input({ name: "cardigan-color" }))).toBe(true);
  });

  it("leaves ordinary fields to the normal rules", () => {
    expect(isAlwaysMasked(input({ name: "company" }))).toBe(false);
    expect(isAlwaysMasked(input({ name: "email", type: "email" }))).toBe(false);
    expect(isAlwaysMasked(input({ name: "search" }))).toBe(false);
  });
});

describe("isUnmaskAllowed", () => {
  it("honours the unmask attribute on the element", () => {
    const element = input({ [UNMASK_ATTRIBUTE]: "" });
    expect(isUnmaskAllowed(element, [])).toBe(true);
  });

  it("honours the unmask attribute on a container", () => {
    const section = document.createElement("div");
    section.setAttribute(UNMASK_ATTRIBUTE, "");
    const element = document.createElement("input");
    section.appendChild(element);
    document.body.appendChild(section);
    expect(isUnmaskAllowed(element, [])).toBe(true);
  });

  it("honours configured selectors", () => {
    const element = input({ class: "search-box" });
    expect(isUnmaskAllowed(element, [".search-box"])).toBe(true);
    expect(isUnmaskAllowed(element, [".something-else"])).toBe(false);
  });

  it("never throws on a broken selector — and never unmasks because of one", () => {
    const element = input({});
    expect(isUnmaskAllowed(element, ["::not-a-selector(("])).toBe(false);
  });
});

describe("buildMaskInputFn", () => {
  const mask = buildMaskInputFn([".allowed"]);

  it("masks ordinary inputs preserving length", () => {
    const element = input({ name: "fullname" });
    expect(mask("Dana Whitfield", element)).toBe("**************");
  });

  it("unmasks allowlisted inputs", () => {
    const element = input({ class: "allowed", name: "search" });
    expect(mask("walnut desk", element)).toBe("walnut desk");
  });

  it("password and card fields ignore the allowlist entirely", () => {
    const password = input({ type: "password", class: "allowed" });
    const card = input({ autocomplete: "cc-number", class: "allowed" });
    password.setAttribute(UNMASK_ATTRIBUTE, "");
    card.setAttribute(UNMASK_ATTRIBUTE, "");

    expect(mask("hunter2hunter2", password)).toBe("********");
    expect(mask("4242424242424242", card)).toBe("********");
  });

  it("uses a fixed-length mask for secrets, so the mask can't leak length", () => {
    const short = input({ type: "password" });
    const long = input({ type: "password" });
    expect(mask("ab", short)).toBe(mask("a-very-long-passphrase", long));
  });

  it("masks when the element is unknown", () => {
    expect(mask("mystery", null)).toBe("*******");
  });

  it("keeps empty values empty", () => {
    expect(mask("", input({ type: "password" }))).toBe("");
  });
});

describe("maskText", () => {
  it("replaces every character", () => {
    expect(maskText("abc def")).toBe("*******");
    expect(maskText("")).toBe("");
  });
});

describe("PRIVATE_BLOCK_SELECTOR", () => {
  it("matches data-private elements", () => {
    const element = document.createElement("div");
    element.setAttribute("data-private", "");
    expect(element.matches(PRIVATE_BLOCK_SELECTOR)).toBe(true);
  });
});
