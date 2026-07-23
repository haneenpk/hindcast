import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EventsModule } from "./events/events.module";
import { HealthController } from "./health.controller";
import { redisConnection } from "./retention/redis";
import { RetentionModule } from "./retention/retention.module";

@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnection() }),
    EventsModule,
    RetentionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
