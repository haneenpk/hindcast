import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@hindcast/db";
import { formatDate } from "@/lib/format";
import { createProject } from "./actions";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-base font-medium">Projects</h1>
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
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-edge bg-surface p-8">
          <p className="font-medium">No projects yet</p>
          <p className="text-muted mt-1 max-w-md text-[13px] leading-relaxed">
            A project maps to one site you want to record. Create the first
            one and Hindcast hands you the install snippet — sessions start
            appearing seconds after it ships.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-edge rounded-lg border border-edge bg-surface">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-raised/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {project.name}
                  </span>
                  <span className="text-faint block truncate font-mono text-xs">
                    {project.key}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-6">
                  <span className="text-muted text-[13px] tabular-nums">
                    {project._count.sessions}{" "}
                    {project._count.sessions === 1 ? "session" : "sessions"}
                  </span>
                  <span className="text-faint text-[13px]">
                    {formatDate(project.createdAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
