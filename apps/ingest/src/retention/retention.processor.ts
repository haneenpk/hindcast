import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { RetentionService } from "./retention.service";

// Two job kinds share the queue: the scheduled "sweep-tick" fans out one
// "sweep-project" job per project, and each of those runs the cleanup for
// its own project — so a slow project can't hold up the others.
@Processor("retention")
export class RetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(RetentionProcessor.name);

  constructor(
    private readonly retention: RetentionService,
    @InjectQueue("retention") private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === "sweep-tick") {
      const ids = await this.retention.sweepableProjectIds();
      await this.queue.addBulk(
        ids.map((projectId) => ({
          name: "sweep-project",
          data: { projectId },
          opts: {
            jobId: `sweep-${projectId}-${job.id}`,
            removeOnComplete: true,
            removeOnFail: 50,
          },
        })),
      );
      return { enqueued: ids.length };
    }

    if (job.name === "sweep-project") {
      const { projectId } = job.data as { projectId: string };
      return this.retention.sweepProject(projectId);
    }

    this.logger.warn(`ignoring unknown job ${job.name}`);
    return undefined;
  }
}
