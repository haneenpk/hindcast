import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ErrorSource, Prisma, prisma } from "@hindcast/db";
import type { CapturedErrorInput, EventBatchInput } from "@hindcast/shared";
import { UAParser } from "ua-parser-js";
import { StorageService } from "../storage/storage.service";

const SOURCE_MAP: Record<CapturedErrorInput["source"], ErrorSource> = {
  window_error: ErrorSource.WINDOW_ERROR,
  unhandled_rejection: ErrorSource.UNHANDLED_REJECTION,
  console_error: ErrorSource.CONSOLE_ERROR,
};

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

    const errors = batch.errors ?? [];
    const network = batch.network ?? [];

    let firstMs = Number.POSITIVE_INFINITY;
    let lastMs = 0;
    for (const event of batch.events) {
      if (event.timestamp < firstMs) firstMs = event.timestamp;
      if (event.timestamp > lastMs) lastMs = event.timestamp;
    }
    // Errors and requests advance session activity too — a batch without
    // DOM events must still move lastEventAt so duration reflects reality.
    let lastActivityMs = lastMs;
    for (const error of errors) {
      if (error.timestamp > lastActivityMs) lastActivityMs = error.timestamp;
    }
    for (const request of network) {
      if (request.timestamp > lastActivityMs) lastActivityMs = request.timestamp;
    }
    const lastActivityAt = new Date(lastActivityMs || batch.startedAt);

    const storageKey = `${project.id}/${batch.sessionId}/${String(batch.seq).padStart(6, "0")}.json.gz`;
    let sizeBytes = 0;
    if (batch.events.length > 0) {
      // Object first, row second: a row pointing at a missing chunk breaks
      // the player, an orphaned object just waits for retention cleanup.
      sizeBytes = await this.storage.putGzippedJson(storageKey, batch.events);
    }

    if (!existing) {
      // Parsed once here so the session list can filter by browser
      // without ever touching the raw user-agent again.
      const parsed = userAgent ? new UAParser(userAgent).getResult() : null;
      try {
        await prisma.session.create({
          data: {
            id: batch.sessionId,
            projectId: project.id,
            startedAt: new Date(batch.startedAt),
            lastEventAt: lastActivityAt,
            entryUrl: batch.url.slice(0, 2048),
            userAgent: userAgent ? userAgent.slice(0, 512) : null,
            browser: parsed?.browser.name ?? null,
            os: parsed?.os.name ?? null,
            durationMs: Math.max(0, lastActivityAt.getTime() - batch.startedAt),
            hasError: errors.length > 0,
          },
        });
      } catch (error) {
        // Two batches of a brand-new session racing each other.
        if (!isUniqueViolation(error)) throw error;
      }
    } else {
      const data: {
        lastEventAt?: Date;
        durationMs?: number;
        hasError?: boolean;
      } = {};
      if (lastActivityAt > existing.lastEventAt) {
        data.lastEventAt = lastActivityAt;
        data.durationMs = Math.max(
          0,
          lastActivityAt.getTime() - existing.startedAt.getTime(),
        );
      }
      if (errors.length > 0 && !existing.hasError) data.hasError = true;
      if (Object.keys(data).length > 0) {
        await prisma.session.update({ where: { id: existing.id }, data });
      }
    }

    let firstDelivery = true;
    if (batch.events.length > 0) {
      try {
        await prisma.eventChunk.create({
          data: {
            sessionId: batch.sessionId,
            seq: batch.seq,
            storageKey,
            sizeBytes,
            eventCount: batch.events.length,
            pageUrl: batch.url.slice(0, 2048),
            firstEventAt: new Date(firstMs),
            lastEventAt: new Date(lastMs),
          },
        });
      } catch (error) {
        // The same chunk delivered twice (beacon and keepalive fetch can
        // both win). The object was overwritten with identical bytes, so
        // keeping the first row is the correct outcome.
        if (!isUniqueViolation(error)) throw error;
        firstDelivery = false;
      }
    } else if (errors.length > 0) {
      // Batches without DOM events have no chunk row to dedupe on; a
      // duplicate delivery is caught by probing for the first entry.
      const probe = errors[0]!;
      const seen = await prisma.errorEvent.findFirst({
        where: {
          sessionId: batch.sessionId,
          timestamp: new Date(probe.timestamp),
          source: SOURCE_MAP[probe.source],
          message: probe.message,
        },
        select: { id: true },
      });
      firstDelivery = seen === null;
    } else if (network.length > 0) {
      const probe = network[0]!;
      const seen = await prisma.networkEvent.findFirst({
        where: {
          sessionId: batch.sessionId,
          timestamp: new Date(probe.timestamp),
          method: probe.method,
          url: probe.url,
        },
        select: { id: true },
      });
      firstDelivery = seen === null;
    }

    if (errors.length > 0 && firstDelivery) {
      await prisma.errorEvent.createMany({
        data: errors.map((error) => ({
          sessionId: batch.sessionId,
          timestamp: new Date(error.timestamp),
          source: SOURCE_MAP[error.source],
          message: error.message,
          stack: error.stack ?? null,
          pageUrl: (error.url ?? batch.url).slice(0, 2048),
        })),
      });
    }

    if (network.length > 0 && firstDelivery) {
      await prisma.networkEvent.createMany({
        data: network.map((request) => ({
          sessionId: batch.sessionId,
          timestamp: new Date(request.timestamp),
          method: request.method,
          url: request.url,
          status: request.status ?? null,
          durationMs: request.durationMs,
        })),
      });
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
