import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";

/**
 * Starts rrweb and hands every event to the caller. Inputs are masked
 * from day one — recordings never contain what visitors type. Returns
 * null when recording can't start; the SDK then stays dormant instead of
 * throwing inside the host page.
 */
export function startRecorder(
  onEvent: (event: eventWithTime) => void,
): (() => void) | null {
  try {
    const stopRecording = record({
      emit(event) {
        try {
          onEvent(event);
        } catch {
          /* a bad event must not kill the rrweb observer */
        }
      },
      maskAllInputs: true,
    });
    return stopRecording ?? null;
  } catch {
    return null;
  }
}
