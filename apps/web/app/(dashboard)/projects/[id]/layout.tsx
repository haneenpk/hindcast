import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/queries";
import { ProjectTabs } from "./project-tabs";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectLayout({
  children,
  params,
}: Props & { children: React.ReactNode }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/projects"
        className="text-muted text-[13px] transition-colors hover:text-fg"
      >
        ← Projects
      </Link>
      <h1 className="mt-2 mb-5 text-base font-medium">{project.name}</h1>
      <ProjectTabs projectId={project.id} />
      {children}
    </div>
  );
}
