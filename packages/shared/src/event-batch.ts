import { z } from "zod";

// What the SDK ships to POST /v1/events. The SDK keeps its own compile-time
// type for this shape (it must not carry zod into browser bundles); this
// schema is the server-side source of truth for the same contract.

// rrweb events are treated as opaque beyond the envelope the pipeline
// relies on — type for filtering, timestamp for seeking.
export const recordedEventSchema = z.looseObject({
  type: z.number().int(),
  timestamp: z.number().int().positive(),
});

export const eventBatchSchema = z.object({
  v: z.literal(1),
  key: z.string().min(1).max(128),
  sessionId: z.uuid(),
  seq: z.number().int().min(0).max(1_000_000),
  startedAt: z.number().int().positive(),
  url: z.string().min(1).max(2048),
  events: z.array(recordedEventSchema).min(1).max(10_000),
});

export type RecordedEventInput = z.infer<typeof recordedEventSchema>;
export type EventBatchInput = z.infer<typeof eventBatchSchema>;
