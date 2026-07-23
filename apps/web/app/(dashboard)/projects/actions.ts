"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, Prisma } from "@hindcast/db";
import { z } from "zod";

const projectName = z.string().trim().min(1).max(64);
const projectId = z.string().min(1).max(64);
// The dashboard only offers these windows; "forever" arrives as an empty
// string and stores null.
const RETENTION_CHOICES = new Set(["7", "30", "90", ""]);

export async function createProject(formData: FormData): Promise<void> {
  const name = projectName.safeParse(formData.get("name"));
  if (!name.success) return;
  const project = await prisma.project.create({ data: { name: name.data } });
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function renameProject(formData: FormData): Promise<void> {
  const id = projectId.safeParse(formData.get("id"));
  const name = projectName.safeParse(formData.get("name"));
  if (!id.success || !name.success) return;
  try {
    await prisma.project.update({
      where: { id: id.data },
      data: { name: name.data },
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  revalidatePath("/projects");
  revalidatePath(`/projects/${id.data}`);
}

export async function setRetention(formData: FormData): Promise<void> {
  const id = projectId.safeParse(formData.get("id"));
  const raw = formData.get("retentionDays");
  if (!id.success || typeof raw !== "string" || !RETENTION_CHOICES.has(raw)) {
    return;
  }
  try {
    await prisma.project.update({
      where: { id: id.data },
      data: { retentionDays: raw === "" ? null : Number(raw) },
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  revalidatePath(`/projects/${id.data}/settings`);
}

export async function deleteProject(formData: FormData): Promise<void> {
  const id = projectId.safeParse(formData.get("id"));
  if (!id.success) return;
  try {
    // Sessions, chunks and event rows cascade; the objects in storage
    // wait for the retention job.
    await prisma.project.delete({ where: { id: id.data } });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  revalidatePath("/projects");
  redirect("/projects");
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
