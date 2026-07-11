const SID_KEY = "hc:sid";
const SEQ_KEY = "hc:seq";
const STARTED_KEY = "hc:started";

export interface SessionHandle {
  id: string;
  startedAt: number;
  /** Monotonic chunk counter, persisted so a reload can never reuse a number. */
  nextSeq(): number;
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the manual v4 */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function storageGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private browsing or full quota — memory-only session below */
  }
}

/**
 * A session spans one tab: reloads and same-tab navigations continue it,
 * a new tab starts fresh. When sessionStorage is unavailable the session
 * simply lives in memory and ends with the page.
 */
export function openSession(): SessionHandle {
  let id = storageGet(SID_KEY);
  let startedAt = Number(storageGet(STARTED_KEY));
  if (!id || !Number.isFinite(startedAt) || startedAt <= 0) {
    id = randomId();
    startedAt = Date.now();
    storageSet(SID_KEY, id);
    storageSet(STARTED_KEY, String(startedAt));
    storageSet(SEQ_KEY, "0");
  }
  let seq = Number(storageGet(SEQ_KEY));
  if (!Number.isFinite(seq) || seq < 0) seq = 0;

  return {
    id,
    startedAt,
    nextSeq() {
      const current = seq;
      seq += 1;
      storageSet(SEQ_KEY, String(seq));
      return current;
    },
  };
}
