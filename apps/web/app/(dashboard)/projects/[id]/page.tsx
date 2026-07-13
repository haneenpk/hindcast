import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@hindcast/db";
import { CopyButton } from "@/components/copy-button";
import { formatDate } from "@/lib/format";
import { renameProject } from "../actions";
import { DeleteProject } from "./delete-project";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  return { title: project?.name ?? "Project" };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { _count: { select: { sessions: true } } },
  });
  if (!project) notFound();

  const endpoint = process.env.NEXT_PUBLIC_INGEST_URL ?? "http://localhost:4100";
  const snippet = `import { init } from "@hindcast/sdk";

init({
  key: "${project.key}",
  endpoint: "${endpoint}",
});`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/projects"
        className="text-muted text-[13px] transition-colors hover:text-fg"
      >
        ← Projects
      </Link>
      <h1 className="mt-2 mb-8 text-base font-medium">{project.name}</h1>

      <section className="mb-8">
        <h2 className="mb-1 text-[13px] font-medium">Install</h2>
        <p className="text-muted mb-3 text-[13px]">
          Call <span className="font-mono text-xs">init()</span> as early as
          possible. Recording starts immediately; inputs are masked in the
          visitor&apos;s browser before anything is sent.
        </p>
        <div className="relative rounded-lg border border-edge bg-surface">
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
            {snippet}
          </pre>
          <div className="absolute top-2.5 right-2.5">
            <CopyButton text={snippet} />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-medium">Details</h2>
        <dl className="divide-y divide-edge rounded-lg border border-edge bg-surface">
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-muted text-[13px]">Project key</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono text-xs">{project.key}</span>
              <CopyButton text={project.key} />
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-muted text-[13px]">Sessions</dt>
            <dd className="text-[13px] tabular-nums">
              {project._count.sessions}
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-muted text-[13px]">Created</dt>
            <dd className="text-[13px]">{formatDate(project.createdAt)}</dd>
          </div>
        </dl>
      </section>

      {project._count.sessions === 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-medium">Sessions</h2>
          <div className="rounded-lg border border-edge bg-surface p-6">
            <p className="text-[13px] font-medium">No sessions yet</p>
            <p className="text-muted mt-1 max-w-md text-[13px] leading-relaxed">
              Ship the snippet above and reload your site — the first
              session shows up here within seconds of the first flush.
            </p>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-[13px] font-medium">Settings</h2>
        <div className="divide-y divide-edge rounded-lg border border-edge bg-surface">
          <form
            action={renameProject}
            className="flex items-center gap-2 px-4 py-3"
          >
            <input type="hidden" name="id" value={project.id} />
            <input
              name="name"
              defaultValue={project.name}
              required
              maxLength={64}
              className="w-56 rounded-md border border-edge bg-bg px-3 py-1.5 text-[13px] outline-none focus:border-edge-strong"
            />
            <button
              type="submit"
              className="rounded-md border border-edge px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-fg"
            >
              Rename
            </button>
          </form>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-muted text-[13px]">
              Deletes the project and every recorded session with it.
            </p>
            <DeleteProject projectId={project.id} />
          </div>
        </div>
      </section>
    </div>
  );
}
