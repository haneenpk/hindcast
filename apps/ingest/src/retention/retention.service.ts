import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@hindcast/db";
import { StorageService } from "../storage/storage.service";

const DAY_MS = 24 * 60 * 60 * 1000;
// Sessions are deleted a batch at a time so a project with a long backlog
// never loads its whole history into memory at once.
const BATCH = 500;

export interface SweepResult {
  projectId: string;
  deletedSessions: number;
  freedBytes: number;
}

export interface StorageStats {
  sessionCount: number;
  totalBytes: number;
  oldestSessionAt: Date | null;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly storage: StorageService) {}

  /** Project ids that opt into cleanup — a null window means keep forever. */
  async sweepableProjectIds(): Promise<string[]> {
    const projects = await prisma.project.findMany({
      where: { retentionDays: { not: null } },
      select: { id: true },
    });
    return projects.map((project) => project.id);
  }

  async sweepProject(projectId: string): Promise<SweepResult> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.retentionDays === null) {
      return { projectId, deletedSessions: 0, freedBytes: 0 };
    }

    const cutoff = new Date(Date.now() - project.retentionDays * DAY_MS);
    let deletedSessions = 0;
    let freedBytes = 0;

    for (;;) {
      const expired = await prisma.session.findMany({
        where: { projectId, startedAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH,
      });
      if (expired.length === 0) break;

      const ids = expired.map((session) => session.id);
      const chunks = await prisma.eventChunk.findMany({
        where: { sessionId: { in: ids } },
        select: { storageKey: true, sizeBytes: true },
      });

      // Objects first: their keys live in the rows we're about to delete,
      // so losing them would orphan the blobs forever. A crash between the
      // two steps just re-runs next sweep — deleting a gone object is a
      // no-op.
      await this.storage.deleteObjects(chunks.map((chunk) => chunk.storageKey));
      const removed = await prisma.session.deleteMany({
        where: { id: { in: ids } },
      });

      deletedSessions += removed.count;
      freedBytes += chunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0);
    }

    if (deletedSessions > 0) {
      this.logger.log(
        `swept ${deletedSessions} session(s) from ${projectId}, freed ${freedBytes} bytes`,
      );
    }
    return { projectId, deletedSessions, freedBytes };
  }

  async sweepAll(): Promise<SweepResult[]> {
    const ids = await this.sweepableProjectIds();
    const results: SweepResult[] = [];
    for (const id of ids) {
      results.push(await this.sweepProject(id));
    }
    return results;
  }

  async storageStats(projectId: string): Promise<StorageStats> {
    const [agg, sessionCount, oldest] = await Promise.all([
      prisma.eventChunk.aggregate({
        _sum: { sizeBytes: true },
        where: { session: { projectId } },
      }),
      prisma.session.count({ where: { projectId } }),
      prisma.session.findFirst({
        where: { projectId },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true },
      }),
    ]);
    return {
      sessionCount,
      totalBytes: agg._sum.sizeBytes ?? 0,
      oldestSessionAt: oldest?.startedAt ?? null,
    };
  }
}
