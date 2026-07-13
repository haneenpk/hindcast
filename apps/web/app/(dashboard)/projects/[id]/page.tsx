import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/queries";

export const metadata: Metadata = { title: "Sessions" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectSessionsPage({ params }: Props) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

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
