import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, prisma } from "@hindcast/db";
import type { EventBatchInput } from "@hindcast/shared";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class EventsService {
  constructor(private readonly storage: StorageService) {}

  async ingest(batch: EventBatchInput, userAgent: string | undefined): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { key: batch.key },
    });
    if (!project) throw new UnauthorizedException("unknown project key");

    const existing = await prisma.session.findUnique({
      where: { id: batch.sessionId },
    });
    // A session id belongs to the project that first used it. Without this
    // check, anyone with their own valid key could append events into
    // another project's sessions.
    if (existing && existing.projectId !== project.id) {
      throw new ForbiddenException();
    }

    let firstMs = Number.POSITIVE_INFINITY;
    let lastMs = 0;
    for (const event of batch.events) {
      if (event.timestamp < firstMs) firstMs = event.timestamp;
      if (event.timestamp > lastMs) lastMs = event.timestamp;
    }
    const firstEventAt = new Date(firstMs);
    const lastEventAt = new Date(lastMs);

    const storageKey = `${project.id}/${batch.sessionId}/${String(batch.seq).padStart(6, "0")}.json.gz`;
    // Object first, row second: a row pointing at a missing chunk breaks
    // the player, an orphaned object just waits for retention cleanup.
    const sizeBytes = await this.storage.putGzippedJson(storageKey, batch.events);

    if (!existing) {
      try {
        await prisma.session.create({
          data: {
            id: batch.sessionId,
            projectId: project.id,
            startedAt: new Date(batch.startedAt),
            lastEventAt,
            entryUrl: batch.url.slice(0, 2048),
            userAgent: userAgent ? userAgent.slice(0, 512) : null,
          },
        });
      } catch (error) {
        // Two batches of a brand-new session racing each other.
        if (!isUniqueViolation(error)) throw error;
      }
    } else if (lastEventAt > existing.lastEventAt) {
      await prisma.session.update({
        where: { id: existing.id },
        data: { lastEventAt },
      });
    }

    try {
      await prisma.eventChunk.create({
        data: {
          sessionId: batch.sessionId,
          seq: batch.seq,
          storageKey,
          sizeBytes,
          eventCount: batch.events.length,
          pageUrl: batch.url.slice(0, 2048),
          firstEventAt,
          lastEventAt,
        },
      });
    } catch (error) {
      // The same chunk delivered twice (beacon and keepalive fetch can
      // both win). The object was overwritten with identical bytes, so
      // keeping the first row is the correct outcome.
      if (!isUniqueViolation(error)) throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
