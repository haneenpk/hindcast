import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@hindcast/db";
import { describeDevice } from "@/lib/device";
import { formatDuration, formatRelative } from "@/lib/format";
import { SessionPlayer } from "./session-player";

interface Props {
  params: Promise<{ id: string; sessionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  return { title: `Session ${sessionId.slice(0, 8)}` };
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

export default async function SessionPage({ params }: Props) {
  const { id, sessionId } = await params;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { chunks: true } } },
  });
  if (!session || session.projectId !== id) notFound();

  const [errors, requests] = await Promise.all([
    prisma.errorEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: "asc" },
    }),
    prisma.networkEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: "asc" },
    }),
  ]);

  // No status means the request never got a response — that's as failed
  // as failed gets.
  const failedRequests = requests.filter(
    (request) => request.status === null || request.status >= 400,
  );

  const markers = [
    ...errors.map((error) => ({
      id: error.id,
      kind: "error" as const,
      timestamp: error.timestamp.getTime(),
      label: error.message.slice(0, 140),
    })),
    ...failedRequests.map((request) => ({
      id: request.id,
      kind: "network" as const,
      timestamp: request.timestamp.getTime(),
      label: `${request.method} ${shortUrl(request.url)} → ${request.status ?? "no response"}`,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const consoleEntries = errors.map((error) => ({
    id: error.id,
    timestamp: error.timestamp.getTime(),
    source: error.source,
    message: error.message,
    stack: error.stack,
    pageUrl: error.pageUrl,
  }));

  const networkEntries = requests.map((request) => ({
    id: request.id,
    timestamp: request.timestamp.getTime(),
    method: request.method,
    url: request.url,
    status: request.status,
    durationMs: request.durationMs,
  }));

  const durationMs =
    session.lastEventAt.getTime() - session.startedAt.getTime();

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <div className="min-w-0">
          <Link
            href={`/projects/${id}`}
            className="text-muted text-[13px] transition-colors hover:text-fg"
          >
            ← Sessions
          </Link>
          <p className="mt-1 truncate text-[13px]">
            <span className="font-mono">{session.id.slice(0, 8)}</span>
            {session.entryUrl ? (
              <span className="text-muted"> · {session.entryUrl}</span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pl-4">
          <span className="rounded-md border border-edge bg-surface px-2 py-1 text-[12px] text-muted">
            {describeDevice(session.userAgent)}
          </span>
          <span className="rounded-md border border-edge bg-surface px-2 py-1 font-mono text-[12px] tabular-nums text-muted">
            {formatDuration(durationMs)}
          </span>
          <span className="rounded-md border border-edge bg-surface px-2 py-1 text-[12px] text-faint">
            {formatRelative(session.startedAt)}
          </span>
          {errors.length > 0 ? (
            <span className="border-red/40 text-red flex items-center gap-1 rounded-md border bg-surface px-2 py-1 text-[12px] tabular-nums">
              <span className="bg-red h-1.5 w-1.5 rounded-full" />
              {errors.length} {errors.length === 1 ? "error" : "errors"}
            </span>
          ) : null}
        </div>
      </div>

      {session.reportedAt ? (
        <div className="border-amber/40 mb-4 rounded-lg border-l-2 bg-surface px-4 py-3">
          <p className="text-amber text-[11px] font-medium tracking-wide uppercase">
            Reported by the visitor · {formatRelative(session.reportedAt)}
          </p>
          {session.reportComment ? (
            <p className="mt-1 text-[13px] leading-relaxed">
              “{session.reportComment}”
            </p>
          ) : (
            <p className="text-muted mt-1 text-[13px]">No comment left.</p>
          )}
        </div>
      ) : null}

      <SessionPlayer
        sessionId={session.id}
        markers={markers}
        consoleEntries={consoleEntries}
        networkEntries={networkEntries}
      />
    </div>
  );
}
