import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import { buildMaskInputFn, PRIVATE_BLOCK_SELECTOR } from "./masking";

export interface RecorderPrivacy {
  unmaskSelectors: string[];
}

/**
 * Starts rrweb and hands every event to the caller. Masking is not
 * optional: every input is masked before it leaves the visitor's
 * browser, allowlisted fields excepted — and password or card fields
 * have no exceptions at all. Elements marked data-private record as
 * same-size placeholder blocks. Returns null when recording can't
 * start; the SDK then stays dormant instead of throwing inside the
 * host page.
 */
export function startRecorder(
  onEvent: (event: eventWithTime) => void,
  privacy: RecorderPrivacy,
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
      maskInputFn: buildMaskInputFn(privacy.unmaskSelectors),
      blockSelector: PRIVATE_BLOCK_SELECTOR,
    });
    return stopRecording ?? null;
  } catch {
    return null;
  }
}
