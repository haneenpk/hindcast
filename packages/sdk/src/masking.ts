// The privacy guarantee lives in this file. Two rules outrank every
// configuration option:
//
//   1. Password and card fields are never unmaskable. No allowlist entry,
//      no attribute, no config can expose them.
//   2. When anything in here is uncertain — a throwing selector, a missing
//      element — the answer is "mask". Over-masking loses a little debug
//      detail; under-masking loses someone's card number.

export const PRIVATE_BLOCK_SELECTOR = "[data-private]";
export const UNMASK_ATTRIBUTE = "data-hc-unmask";

// Fixed length on purpose: a length-preserving mask tells anyone watching
// the replay exactly how long the password or card number is.
const FIXED_MASK = "********";

// Biased toward false positives: a harmless field named "cardigan-color"
// gets masked, which costs nothing. The reverse mistake is not acceptable.
const CARD_HINT = /card|cvv|cvc|csc|security[-_ ]?code|\bpan\b|cc[-_ ]?(num|number|exp)/i;

export function isAlwaysMasked(element: HTMLElement): boolean {
  try {
    const type = (element.getAttribute("type") ?? "").toLowerCase();
    if (type === "password") return true;

    const autocomplete = (
      element.getAttribute("autocomplete") ?? ""
    ).toLowerCase();
    if (
      autocomplete.startsWith("cc-") ||
      autocomplete === "current-password" ||
      autocomplete === "new-password" ||
      autocomplete === "one-time-code"
    ) {
      return true;
    }

    const hints = `${element.getAttribute("name") ?? ""} ${element.id ?? ""}`;
    return CARD_HINT.test(hints);
  } catch {
    return true;
  }
}

export function isUnmaskAllowed(
  element: HTMLElement,
  unmaskSelectors: string[],
): boolean {
  try {
    // The attribute may sit on a container, so a whole form section can
    // be allowlisted at once.
    if (element.closest?.(`[${UNMASK_ATTRIBUTE}]`)) return true;
    for (const selector of unmaskSelectors) {
      try {
        if (element.matches(selector)) return true;
      } catch {
        /* a broken selector never unmasks anything */
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function maskText(text: string): string {
  return "*".repeat(text.length);
}

/** What the recorder hands rrweb as maskInputFn. */
export function buildMaskInputFn(
  unmaskSelectors: string[],
): (text: string, element: HTMLElement | null) => string {
  return (text, element) => {
    try {
      if (!text) return "";
      if (!element) return maskText(text);
      if (isAlwaysMasked(element)) return FIXED_MASK;
      if (isUnmaskAllowed(element, unmaskSelectors)) return text;
      return maskText(text);
    } catch {
      return FIXED_MASK;
    }
  };
}
