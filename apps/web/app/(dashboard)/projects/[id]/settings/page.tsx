import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@hindcast/db";
import { CopyButton } from "@/components/copy-button";
import { formatBytes, formatDate, formatRelative } from "@/lib/format";
import { getProject } from "@/lib/queries";
import { renameProject, setRetention } from "../../actions";
import { DeleteProject } from "../delete-project";
import { RotateKey } from "../rotate-key";

export const metadata: Metadata = { title: "Settings" };

const RETENTION_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "", label: "Keep forever" },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectSettingsPage({ params }: Props) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [storage, oldest] = await Promise.all([
    prisma.eventChunk.aggregate({
      _sum: { sizeBytes: true },
      where: { session: { projectId: project.id } },
    }),
    prisma.session.findFirst({
      where: { projectId: project.id },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    }),
  ]);
  const totalBytes = storage._sum.sizeBytes ?? 0;
  const retentionValue =
    project.retentionDays === null ? "" : String(project.retentionDays);

  const endpoint = process.env.NEXT_PUBLIC_INGEST_URL ?? "http://localhost:4100";
  const scriptSnippet = `<script async
  src="${endpoint}/r.js"
  data-key="${project.key}"
  data-endpoint="${endpoint}"></script>`;
  const installCommand = "npm i @hindcast/sdk";
  const npmSnippet = `import { init } from "@hindcast/sdk";

init({
  key: "${project.key}",
  endpoint: "${endpoint}",
});`;

  return (
    <div>
      <section className="mb-8">
        <h2 className="mb-1 text-[13px] font-medium">Install</h2>
        <p className="text-muted mb-3 text-[13px]">
          Drop one async script tag in your{" "}
          <span className="font-mono text-xs">&lt;head&gt;</span>. Recording
          starts immediately; inputs are masked in the visitor&apos;s browser
          before anything is sent.
        </p>
        <div className="relative mb-3 rounded-lg border border-edge bg-surface">
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
            {scriptSnippet}
          </pre>
          <div className="absolute top-2.5 right-2.5">
            <CopyButton text={scriptSnippet} />
          </div>
        </div>
        <p className="text-muted mb-2 text-[13px]">
          Using a bundler? Install{" "}
          <span className="font-mono text-xs">@hindcast/sdk</span> and call{" "}
          <span className="font-mono text-xs">init()</span> instead.
        </p>
        <div className="relative mb-2 rounded-lg border border-edge bg-surface">
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
            {installCommand}
          </pre>
          <div className="absolute top-2.5 right-2.5">
            <CopyButton text={installCommand} />
          </div>
        </div>
        <div className="relative rounded-lg border border-edge bg-surface">
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
            {npmSnippet}
          </pre>
          <div className="absolute top-2.5 right-2.5">
            <CopyButton text={npmSnippet} />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-medium">Details</h2>
        <dl className="divide-y divide-edge rounded-lg border border-edge bg-surface">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <dt className="text-muted text-[13px]">Project key</dt>
              <dd className="mt-0.5 font-mono text-xs">{project.key}</dd>
              <p className="text-faint mt-1 text-[11px]">
                Rotating issues a new key at once; update the snippet or the
                old one starts returning 401.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CopyButton text={project.key} />
              <RotateKey projectId={project.id} />
            </div>
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

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-medium">Storage &amp; retention</h2>
        <div className="divide-y divide-edge rounded-lg border border-edge bg-surface">
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-muted text-[13px]">Stored events</dt>
            <dd className="font-mono text-xs tabular-nums">
              {formatBytes(totalBytes)}
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-muted text-[13px]">Oldest session</dt>
            <dd className="text-[13px]">
              {oldest ? formatRelative(oldest.startedAt) : "—"}
            </dd>
          </div>
          <form
            action={setRetention}
            className="flex items-center justify-between gap-2 px-4 py-3"
          >
            <div>
              <p className="text-muted text-[13px]">Keep sessions for</p>
              <p className="text-faint mt-0.5 text-[11px]">
                Older sessions and their stored events are deleted on a
                recurring sweep.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input type="hidden" name="id" value={project.id} />
              <select
                name="retentionDays"
                defaultValue={retentionValue}
                className="rounded-md border border-edge bg-bg px-2.5 py-1.5 text-[13px] outline-none focus:border-edge-strong"
              >
                {RETENTION_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-edge px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-fg"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-medium">General</h2>
        <div className="rounded-lg border border-edge bg-surface">
          <form
            action={renameProject}
            className="flex items-center justify-between gap-2 px-4 py-3"
          >
            <label className="text-muted text-[13px]" htmlFor="project-name">
              Project name
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <input type="hidden" name="id" value={project.id} />
              <input
                id="project-name"
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
            </div>
          </form>
        </div>
      </section>

      <section>
        <h2 className="text-red mb-3 text-[13px] font-medium">Danger zone</h2>
        <div className="border-red/30 flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
          <div>
            <p className="text-[13px]">Delete this project</p>
            <p className="text-muted mt-0.5 text-[13px]">
              Every recorded session goes with it. This can&apos;t be undone.
            </p>
          </div>
          <DeleteProject projectId={project.id} />
        </div>
      </section>
    </div>
  );
}
