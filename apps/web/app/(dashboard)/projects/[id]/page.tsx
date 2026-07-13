import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@hindcast/db";
import { describeDevice } from "@/lib/device";
import { formatDuration, formatRelative } from "@/lib/format";
import { getProject } from "@/lib/queries";

export const metadata: Metadata = { title: "Sessions" };

interface Props {
  params: Promise<{ id: string }>;
}

function entryPath(entryUrl: string | null): string {
  if (!entryUrl) return "—";
  try {
    const url = new URL(entryUrl);
    return url.pathname + url.search;
  } catch {
    return entryUrl;
  }
}

export default async function ProjectSessionsPage({ params }: Props) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const sessions = await prisma.session.findMany({
    where: { projectId: project.id },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  // Distinct page urls per session, one grouped query for the whole list.
  const pageRows = await prisma.eventChunk.groupBy({
    by: ["sessionId", "pageUrl"],
    where: { sessionId: { in: sessions.map((s) => s.id) } },
  });
  const pageCounts = new Map<string, number>();
  for (const row of pageRows) {
    pageCounts.set(row.sessionId, (pageCounts.get(row.sessionId) ?? 0) + 1);
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-edge bg-surface p-6">
        <p className="text-[13px] font-medium">No sessions yet</p>
        <p className="text-muted mt-1 max-w-md text-[13px] leading-relaxed">
          Grab the snippet from{" "}
          <Link href={`/projects/${project.id}/settings`} className="underline">
            settings
          </Link>{" "}
          and ship it — the first session shows up here within seconds of the
          first flush.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-edge bg-surface">
      <div className="text-faint grid grid-cols-[minmax(0,1fr)_150px_60px_70px_80px] gap-3 border-b border-edge px-4 py-2 text-[11px] font-medium tracking-wide uppercase">
        <span>Session</span>
        <span>Device</span>
        <span className="text-right">Pages</span>
        <span className="text-right">Duration</span>
        <span className="text-right">Started</span>
      </div>
      <ul className="divide-y divide-edge">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="grid grid-cols-[minmax(0,1fr)_150px_60px_70px_80px] items-center gap-3 px-4 py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px]">
                {entryPath(session.entryUrl)}
              </span>
              <span className="text-faint block font-mono text-[11px]">
                {session.id.slice(0, 8)}
              </span>
            </span>
            <span className="text-muted truncate text-[13px]">
              {describeDevice(session.userAgent)}
            </span>
            <span className="text-muted text-right text-[13px] tabular-nums">
              {pageCounts.get(session.id) ?? 1}
            </span>
            <span className="text-right font-mono text-xs tabular-nums">
              {formatDuration(
                session.lastEventAt.getTime() - session.startedAt.getTime(),
              )}
            </span>
            <span className="text-faint text-right text-[13px]">
              {formatRelative(session.startedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
