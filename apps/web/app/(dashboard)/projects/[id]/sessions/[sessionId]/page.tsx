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

export default async function SessionPage({ params }: Props) {
  const { id, sessionId } = await params;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { chunks: true } } },
  });
  if (!session || session.projectId !== id) notFound();

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
        <p className="text-muted shrink-0 pl-4 text-[13px]">
          {describeDevice(session.userAgent)} ·{" "}
          <span className="font-mono text-xs">
            {formatDuration(durationMs)}
          </span>{" "}
          · {formatRelative(session.startedAt)}
        </p>
      </div>

      <SessionPlayer sessionId={session.id} />
    </div>
  );
}
