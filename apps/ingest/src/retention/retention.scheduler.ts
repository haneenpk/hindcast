import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { env } from "../env";

// Registers the repeatable tick once per boot. upsert is idempotent, so
// restarting the server just refreshes the schedule rather than piling
// up duplicate timers.
@Injectable()
export class RetentionScheduler implements OnModuleInit {
  private readonly logger = new Logger(RetentionScheduler.name);

  constructor(@InjectQueue("retention") private readonly queue: Queue) {}

  onModuleInit(): void {
    // Fire-and-forget on purpose: a missing Redis must not stop the ingest
    // API from taking batches, and awaiting this would hang boot while
    // BullMQ waits for a connection. Left unawaited, the command sits in the
    // offline queue and lands once Redis is back — meanwhile ingest is
    // already up and accepting recordings.
    this.queue
      .upsertJobScheduler(
        "retention-sweep",
        { every: env.RETENTION_SWEEP_MINUTES * 60_000 },
        { name: "sweep-tick" },
      )
      .then(() =>
        this.logger.log(
          `retention sweep scheduled every ${env.RETENTION_SWEEP_MINUTES}m`,
        ),
      )
      .catch((error) =>
        this.logger.error("could not schedule retention sweep", error as Error),
      );
  }
}
