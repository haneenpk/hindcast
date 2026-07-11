import { Module } from "@nestjs/common";
import { StorageService } from "../storage/storage.service";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  controllers: [EventsController],
  providers: [EventsService, StorageService],
})
export class EventsModule {}
