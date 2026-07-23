import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { StorageService } from "../storage/storage.service";
import { RetentionProcessor } from "./retention.processor";
import { RetentionScheduler } from "./retention.scheduler";
import { RetentionService } from "./retention.service";

@Module({
  imports: [BullModule.registerQueue({ name: "retention" })],
  providers: [
    RetentionService,
    StorageService,
    RetentionProcessor,
    RetentionScheduler,
  ],
  exports: [RetentionService],
})
export class RetentionModule {}
