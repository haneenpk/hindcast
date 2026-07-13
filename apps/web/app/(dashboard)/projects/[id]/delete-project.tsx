"use client";

import { useState } from "react";
import { deleteProject } from "../actions";

export function DeleteProject({ projectId }: { projectId: string }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-red rounded-md border border-edge px-3 py-1.5 text-[13px] transition-colors hover:border-red/50"
      >
        Delete project
      </button>
    );
  }

  return (
    <form action={deleteProject} className="flex items-center gap-2">
      <input type="hidden" name="id" value={projectId} />
      <button
        type="submit"
        className="bg-red rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
      >
        Delete forever
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
