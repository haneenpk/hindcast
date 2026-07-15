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

// Request outcomes only — the schema has no field a body could even
// arrive in.
export const capturedRequestSchema = z.object({
  timestamp: z.number().int().positive(),
  method: z.string().min(1).max(16),
  url: z.string().min(1).max(2048),
  status: z.number().int().min(100).max(999).optional(),
  durationMs: z.number().int().min(0).max(3_600_000),
});

export const eventBatchSchema = z
  .object({
    v: z.literal(1),
    key: z.string().min(1).max(128),
    sessionId: z.uuid(),
    seq: z.number().int().min(0).max(1_000_000),
    startedAt: z.number().int().positive(),
    url: z.string().min(1).max(2048),
    // A batch may carry no DOM events: an async crash or a burst of
    // requests on an idle page still has to reach the server.
    events: z.array(recordedEventSchema).max(10_000),
    errors: z.array(capturedErrorSchema).max(50).optional(),
    network: z.array(capturedRequestSchema).max(500).optional(),
  })
  .refine(
    (batch) =>
      batch.events.length > 0 ||
      (batch.errors?.length ?? 0) > 0 ||
      (batch.network?.length ?? 0) > 0,
    { message: "batch carries no events, errors or requests" },
  );

export type RecordedEventInput = z.infer<typeof recordedEventSchema>;
export type CapturedErrorInput = z.infer<typeof capturedErrorSchema>;
export type CapturedRequestInput = z.infer<typeof capturedRequestSchema>;
export type EventBatchInput = z.infer<typeof eventBatchSchema>;
