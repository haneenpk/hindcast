import { cache } from "react";
import { prisma } from "@hindcast/db";

// Deduped per request: the project layout and its pages both need this.
export const getProject = cache(async (id: string) => {
  return prisma.project.findUnique({
    where: { id },
    include: { _count: { select: { sessions: true } } },
  });
});
