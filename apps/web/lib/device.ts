import { UAParser } from "ua-parser-js";

/** "Chrome · Windows" — coarse on purpose; the row is a scanning aid. */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const parsed = new UAParser(userAgent).getResult();
  const browser = parsed.browser.name;
  const os = parsed.os.name;
  const parts = [browser, os].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Unknown device";
}
