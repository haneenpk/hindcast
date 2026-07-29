import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, Prisma } from "@hindcast/db";
import { describeDevice } from "@/lib/device";
import { formatDuration, formatRelative } from "@/lib/format";
import { getProject } from "@/lib/queries";
import { SessionFilters } from "./session-filters";

export const metadata: Metadata = { title: "Sessions" };

const PAGE_SIZE = 25;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
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

function deviceLabel(session: {
  browser: string | null;
  os: string | null;
  userAgent: string | null;
}): string {
  if (session.browser) {
    return session.os ? `${session.browser} · ${session.os}` : session.browser;
  }
  return describeDevice(session.userAgent);
}

export default async function ProjectSessionsPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const device = sp.device || undefined;
  const dur = sp.dur;
  const errorsOnly = sp.errors === "1";
  const reportedOnly = sp.reported === "1";
  const page = Math.max(1, Number(sp.p) || 1);
  const filtered = Boolean(q || device || dur || errorsOnly || reportedOnly);

  const where: Prisma.SessionWhereInput = { projectId: project.id };
  if (errorsOnly) where.hasError = true;
  if (reportedOnly) where.reportedAt = { not: null };
  if (device) where.browser = device;
  if (dur === "short") where.durationMs = { lt: 60_000 };
  if (dur === "medium") where.durationMs = { gte: 60_000, lt: 300_000 };
  if (dur === "long") where.durationMs = { gte: 300_000 };
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { entryUrl: { contains: q, mode: "insensitive" } },
      // "page" means any page the session touched, not just the entry.
      { chunks: { some: { pageUrl: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [sessions, total, deviceRows] = await Promise.all([
    prisma.session.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.session.count({ where }),
    prisma.session.groupBy({
      by: ["browser"],
      where: { projectId: project.id, browser: { not: null } },
    }),
  ]);

  const devices = deviceRows
    .map((row) => row.browser)
    .filter((name): name is string => name !== null)
    .sort();

  const pageRows = await prisma.eventChunk.groupBy({
    by: ["sessionId", "pageUrl"],
    where: { sessionId: { in: sessions.map((s) => s.id) } },
  });
  const pageCounts = new Map<string, number>();
  for (const row of pageRows) {
    pageCounts.set(row.sessionId, (pageCounts.get(row.sessionId) ?? 0) + 1);
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number): string => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (device) next.set("device", device);
    if (dur) next.set("dur", dur);
    if (errorsOnly) next.set("errors", "1");
    if (reportedOnly) next.set("reported", "1");
    if (n > 1) next.set("p", String(n));
    const query = next.toString();
    return query ? `/projects/${project.id}?${query}` : `/projects/${project.id}`;
  };

  if (total === 0 && !filtered) {
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
    <div>
      <SessionFilters devices={devices} />

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-edge bg-surface p-6">
          <p className="text-[13px] font-medium">No sessions match</p>
          <p className="text-muted mt-1 text-[13px]">
            Loosen the filters or{" "}
            <Link href={`/projects/${project.id}`} className="underline">
              clear them
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-edge bg-surface">
          <div className="text-faint grid grid-cols-[minmax(0,1fr)_140px_60px_92px] gap-3 border-b border-edge px-4 py-2 text-[11px] font-medium tracking-wide uppercase">
            <span>Session</span>
            <span>Device</span>
            <span className="text-right">Length</span>
            <span className="text-right">When</span>
          </div>
          <ul className="divide-y divide-edge">
            {sessions.map((session) => {
              const pages = pageCounts.get(session.id) ?? 1;
              return (
                <li key={session.id}>
                  <Link
                    href={`/projects/${project.id}/sessions/${session.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_140px_60px_92px] items-center gap-3 px-4 py-2 transition-colors hover:bg-raised"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex w-2.5 shrink-0 justify-center gap-1">
                        {session.hasError ? (
                          <span
                            className="bg-red h-1.5 w-1.5 rounded-full"
                            title="Captured errors"
                          />
                        ) : null}
                        {session.reportedAt ? (
                          <span
                            className="bg-amber h-1.5 w-1.5 rounded-full"
                            title="Reported by the visitor"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">
                          {entryPath(session.entryUrl)}
                        </span>
                        <span className="text-faint block truncate font-mono text-[11px]">
                          {session.id.slice(0, 8)}
                          {pages > 1 ? ` · ${pages} pages` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="text-muted truncate text-[13px]">
                      {deviceLabel(session)}
                    </span>
                    <span className="text-muted text-right font-mono text-xs tabular-nums">
                      {formatDuration(
                        session.durationMs ||
                          session.lastEventAt.getTime() -
                            session.startedAt.getTime(),
                      )}
                    </span>
                    <span className="text-faint text-right text-[13px]">
                      {formatRelative(session.startedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="text-muted mt-3 flex items-center justify-between text-[13px]">
          <span className="tabular-nums">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{" "}
            {total}
          </span>
          <span className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="hover:text-fg">
                ← Newer
              </Link>
            ) : (
              <span className="text-faint">← Newer</span>
            )}
            {page < lastPage ? (
              <Link href={pageHref(page + 1)} className="hover:text-fg">
                Older →
              </Link>
            ) : (
              <span className="text-faint">Older →</span>
            )}
          </span>
        </div>
      ) : null}
    </div>
  );
}
