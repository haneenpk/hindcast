import type { eventWithTime } from "@rrweb/types";

// The wire contract with the ingest API. Versioned from the start so the
// server can refuse payloads it no longer understands.
export interface EventBatch {
  v: 1;
  key: string;
  sessionId: string;
  seq: number;
  startedAt: number;
  url: string;
  events: eventWithTime[];
}
