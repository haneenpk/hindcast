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

export const capturedErrorSchema = z.object({
  timestamp: z.number().int().positive(),
  source: z.enum(["window_error", "unhandled_rejection", "console_error"]),
  message: z.string().min(1).max(4000),
  stack: z.string().max(16_000).optional(),
  url: z.string().max(2048).optional(),
});

export const eventBatchSchema = z
  .object({
    v: z.literal(1),
    key: z.string().min(1).max(128),
    sessionId: z.uuid(),
    seq: z.number().int().min(0).max(1_000_000),
    startedAt: z.number().int().positive(),
    url: z.string().min(1).max(2048),
    // A batch may be errors-only: an async crash on an idle page produces
    // no DOM events, and it still has to reach the server.
    events: z.array(recordedEventSchema).max(10_000),
    errors: z.array(capturedErrorSchema).max(50).optional(),
  })
  .refine(
    (batch) => batch.events.length > 0 || (batch.errors?.length ?? 0) > 0,
    { message: "batch carries neither events nor errors" },
  );

export type RecordedEventInput = z.infer<typeof recordedEventSchema>;
export type CapturedErrorInput = z.infer<typeof capturedErrorSchema>;
export type EventBatchInput = z.infer<typeof eventBatchSchema>;
