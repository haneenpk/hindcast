import { Module } from "@nestjs/common";
import { RateLimitGuard } from "../security/rate-limit.guard";
import { RateLimiterService } from "../security/rate-limiter.service";
import { StorageService } from "../storage/storage.service";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  controllers: [EventsController],
  providers: [EventsService, StorageService, RateLimiterService, RateLimitGuard],
})
export class EventsModule {}
