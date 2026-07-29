import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@hindcast/db";
import { formatRelative } from "@/lib/format";
import { createProject } from "./actions";

export const metadata: Metadata = { title: "Projects" };

// Without this, next build prerenders the list once and next start serves
// that snapshot forever — projects created after the build never appear.
export const dynamic = "force-dynamic";

function entryPath(url: string | null): string {
  if (!url) return "—";
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function CreateForm() {
  return (
    <form action={createProject} className="flex gap-2">
      <input
        name="name"
        required
        maxLength={64}
        placeholder="Project name"
        className="w-48 rounded-md border border-edge bg-surface px-3 py-1.5 text-[13px] outline-none placeholder:text-faint focus:border-edge-strong"
      />
      <button
        type="submit"
        className="rounded-md bg-white px-3 py-1.5 text-[13px] font-medium text-black transition-opacity hover:opacity-90"
      >
        Create
      </button>
    </form>
  );
}

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-medium">Projects</h1>
          <CreateForm />
        </div>
        <div className="rounded-lg border border-edge bg-surface p-8">
          <p className="font-medium">No projects yet</p>
          <p className="text-muted mt-1 max-w-md text-[13px] leading-relaxed">
            A project maps to one site you want to record. Create the first
            one and Hindcast hands you the install snippet — sessions start
            appearing seconds after it ships.
          </p>
        </div>
      </div>
    );
  }

  const ids = projects.map((project) => project.id);
  const [erroredRows, activityRows, attention] = await Promise.all([
    prisma.session.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, hasError: true },
      _count: { _all: true },
    }),
    prisma.session.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids } },
      _max: { startedAt: true },
    }),
    // The cross-project feed: whatever broke or got reported most recently,
    // wherever it happened — the first thing worth looking at each morning.
    prisma.session.findMany({
      where: {
        projectId: { in: ids },
        OR: [{ hasError: true }, { reportedAt: { not: null } }],
      },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { project: { select: { name: true } } },
    }),
  ]);

  const erroredByProject = new Map(
    erroredRows.map((row) => [row.projectId, row._count._all]),
  );
  const lastActiveByProject = new Map(
    activityRows.map((row) => [row.projectId, row._max.startedAt]),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-base font-medium">Projects</h1>
        <CreateForm />
      </div>

      <section className="mb-9">
        <h2 className="mb-3 flex items-baseline gap-2 text-[15px] font-medium">
          Needs attention
          {attention.length > 0 ? (
            <span className="text-faint text-xs tabular-nums">
              {attention.length}
            </span>
          ) : null}
        </h2>
        {attention.length === 0 ? (
          <div className="rounded-lg border border-edge bg-surface px-4 py-6">
            <p className="text-[13px]">Nothing broken or reported.</p>
            <p className="text-muted mt-1 text-[13px]">
              When a session captures an error or a visitor reports one, it
              surfaces here first.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface">
            {attention.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/projects/${session.projectId}/sessions/${session.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-raised"
                >
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
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {entryPath(session.entryUrl)}
                  </span>
                  <span className="text-muted shrink-0 truncate text-[13px]">
                    {session.project.name}
                  </span>
                  <span className="text-faint w-16 shrink-0 text-right text-[13px] tabular-nums">
                    {formatRelative(session.startedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-faint mb-2 text-[11px] font-medium tracking-wide uppercase">
          All projects
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => {
            const errored = erroredByProject.get(project.id) ?? 0;
            const lastActive = lastActiveByProject.get(project.id) ?? null;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-lg border border-edge bg-surface p-4 transition-colors hover:bg-raised"
              >
                <div className="mb-3 flex items-start gap-2">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      errored > 0 ? "bg-red" : "bg-green"
                    }`}
                    title={errored > 0 ? `${errored} errored` : "healthy"}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="text-faint truncate font-mono text-xs">
                      {project.key}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="text-muted tabular-nums">
                    {project._count.sessions}{" "}
                    {project._count.sessions === 1 ? "session" : "sessions"}
                  </span>
                  {errored > 0 ? (
                    <span className="text-red tabular-nums">
                      {errored} errored
                    </span>
                  ) : null}
                  <span className="text-faint ml-auto">
                    {lastActive ? formatRelative(lastActive) : "no activity"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
