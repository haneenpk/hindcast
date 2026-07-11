import type { eventWithTime } from "@rrweb/types";

const DEFAULT_MAX_BYTES = 512 * 1024;

/**
 * Holds recorded events between flushes. A rough JSON size is tracked on
 * the way in so a burst of DOM churn can't grow the buffer without bound —
 * when push() returns true the caller should flush right away.
 */
export class EventBuffer {
  private events: eventWithTime[] = [];
  private bytes = 0;

  constructor(private readonly maxBytes: number = DEFAULT_MAX_BYTES) {}

  push(event: eventWithTime): boolean {
    this.events.push(event);
    try {
      this.bytes += JSON.stringify(event).length;
    } catch {
      this.bytes += 1024;
    }
    return this.bytes >= this.maxBytes;
  }

  drain(): eventWithTime[] {
    if (this.events.length === 0) return [];
    const drained = this.events;
    this.events = [];
    this.bytes = 0;
    return drained;
  }

  get length(): number {
    return this.events.length;
  }
}
