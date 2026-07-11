import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
} from "@nestjs/common";
import { eventBatchSchema } from "@hindcast/shared";
import { EventsService } from "./events.service";

@Controller("v1")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post("events")
  @HttpCode(202)
  async ingest(
    @Body() body: unknown,
    @Headers("user-agent") userAgent: string | undefined,
  ): Promise<{ accepted: true }> {
    const parsed = eventBatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("malformed batch");
    await this.events.ingest(parsed.data, userAgent);
    return { accepted: true };
  }
}
