"use client";

import { useState } from "react";
import { rotateKey } from "../actions";

export function RotateKey({ projectId }: { projectId: string }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-muted rounded-md border border-edge px-3 py-1.5 text-[13px] transition-colors hover:text-fg"
      >
        Rotate key
      </button>
    );
  }

  return (
    <form action={rotateKey} className="flex items-center gap-2">
      <input type="hidden" name="id" value={projectId} />
      <button
        type="submit"
        className="rounded-md border border-edge px-3 py-1.5 text-[13px] font-medium text-fg transition-colors hover:border-edge-strong"
      >
        Rotate now
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-muted rounded-md px-3 py-1.5 text-[13px] hover:text-fg"
      >
        Cancel
      </button>
    </form>
  );
}
