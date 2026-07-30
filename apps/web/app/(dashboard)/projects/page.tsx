import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@hindcast/db";
import { formatRelative } from "@/lib/format";
import { createProject } from "./actions";

export const metadata: Metadata = { title: "Projects" };

// Without this, next build prerenders the list once and next start serves
// that snapshot forever — projects created after the build never appear.
export const dynamic = "force-dynamic";

// The error rate and sparkline read from the most recent slice of a project's
// sessions, so both mean the same thing the footer note promises.
const RECENT_WINDOW = 100;
const SPARK_BUCKETS = 12;

function entryPath(url: string | null): string {
  if (!url) return "—";
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function bucketErrors(sessionsDesc: { hasError: boolean }[]): number[] {
  const buckets = new Array<number>(SPARK_BUCKETS).fill(0);
  const count = sessionsDesc.length;
  if (count === 0) return buckets;
  // Oldest → newest, so the line reads left to right like time.
  for (let i = 0; i < count; i += 1) {
    const session = sessionsDesc[count - 1 - i];
    if (!session?.hasError) continue;
    const bucket = Math.min(
      SPARK_BUCKETS - 1,
      Math.floor((i / count) * SPARK_BUCKETS),
    );
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
  }
  return buckets;
}

function Sparkline({ data, healthy }: { data: number[]; healthy: boolean }) {
  const width = 64;
  const height = 26;
  const max = Math.max(1, ...data);
  const flat = data.every((value) => value === 0);
  const stroke = healthy ? "var(--color-green)" : "var(--color-red)";

  const points = flat
    ? `0,${height / 2} ${width},${height / 2}`
    : data
        .map((value, index) => {
          const x = (index / (data.length - 1)) * width;
          const y = height - 1 - (value / max) * (height - 2);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={flat ? 0.5 : 0.9}
      />
    </svg>
  );
}

function Metric({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: string;
}) {
  return (
    <div>
      <p
        className={`text-[20px] leading-none font-medium tabular-nums ${tone ?? ""}`}
      >
        {value}
      </p>
      <p className="text-muted mt-1.5 text-[11px]">{label}</p>
    </div>
  );
}

function CreateForm() {
  return (
    <form action={createProject} className="flex gap-2.5">
      <input
        name="name"
        required
        maxLength={64}
        placeholder="Project name"
        className="placeholder:text-faint focus:border-edge-strong w-75 rounded-md border border-edge bg-surface px-3.5 py-2.5 text-[13px] outline-none"
      />
      <button
        type="submit"
        className="rounded-md bg-white px-4 py-2.5 text-[13px] font-medium text-black transition-opacity hover:opacity-90"
      >
        Create project
      </button>
    </form>
  );
}

function Header() {
  return (
    <div className="mb-8 flex items-center justify-between">
      <h1 className="text-[26px] font-medium tracking-tight">Projects</h1>
      <CreateForm />
    </div>
  );
}

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });

  if (projects.length === 0) {
    return (
      <div>
        <Header />
        <div className="rounded-lg border border-edge bg-surface p-8">
          <p className="font-medium">No projects yet</p>
          <p className="text-muted mt-1 max-w-md text-[13px] leading-relaxed">
            A project maps to one site you want to record. Create the first one
            and Hindcast hands you the install snippet — sessions start
            appearing seconds after it ships.
          </p>
        </div>
      </div>
    );
  }

  const ids = projects.map((project) => project.id);

  const [attention, recentByProject] = await Promise.all([
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
    // The recent slice per project drives the error rate, sparkline, health
    // dot and "last activity" — one bounded read each, no session bodies.
    Promise.all(
      projects.map((project) =>
        prisma.session.findMany({
          where: { projectId: project.id },
          orderBy: { startedAt: "desc" },
          take: RECENT_WINDOW,
          select: { startedAt: true, hasError: true },
        }),
      ),
    ),
  ]);

  const stats = new Map(
    projects.map((project, index) => {
      const recent = recentByProject[index] ?? [];
      const errored = recent.filter((session) => session.hasError).length;
      const rate =
        recent.length > 0 ? Math.round((errored / recent.length) * 100) : 0;
      return [
        project.id,
        {
          errored,
          rate,
          lastActive: recent[0]?.startedAt ?? null,
          spark: bucketErrors(recent),
        },
      ];
    }),
  );

  return (
    <div>
      <Header />

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-medium">
          Needs attention
          {attention.length > 0 ? (
            <span className="bg-red/10 text-red rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
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
          <ul className="divide-edge divide-y rounded-lg border border-edge bg-surface">
            {attention.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/projects/${session.projectId}/sessions/${session.id}`}
                  className="hover:bg-raised/40 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      session.hasError ? "bg-red" : "bg-amber"
                    }`}
                    title={
                      session.hasError
                        ? "Captured errors"
                        : "Reported by the visitor"
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
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
        <h2 className="text-muted mb-3 text-[15px] font-medium">
          All projects
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const stat = stats.get(project.id);
            const errored = stat?.errored ?? 0;
            const rate = stat?.rate ?? 0;
            const healthy = errored === 0;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="hover:bg-raised/40 flex flex-col rounded-lg border border-edge bg-surface p-5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      healthy ? "bg-green" : "bg-red"
                    }`}
                    title={healthy ? "healthy" : `${errored} errored`}
                  />
                  <span className="truncate text-[15px] font-medium">
                    {project.name}
                  </span>
                </div>
                <p className="text-faint ml-3.5 truncate font-mono text-xs">
                  {project.key}
                </p>

                <div className="mt-5 flex items-end gap-6">
                  <Metric
                    value={project._count.sessions.toLocaleString("en")}
                    label="Sessions"
                  />
                  <Metric
                    value={errored.toString()}
                    label="Errors"
                    tone={healthy ? "text-green" : "text-red"}
                  />
                  <Metric value={`${rate}%`} label="Error rate" />
                  <div className="ml-auto self-center">
                    <Sparkline data={stat?.spark ?? []} healthy={healthy} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-edge pt-3 text-[12px]">
                  <span className="text-muted">Last activity</span>
                  <span className="text-faint tabular-nums">
                    {stat?.lastActive
                      ? formatRelative(stat.lastActive)
                      : "No activity"}
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
