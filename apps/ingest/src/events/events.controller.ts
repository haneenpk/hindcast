import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { eventBatchSchema, sessionReportSchema } from "@hindcast/shared";
import { RateLimitGuard } from "../security/rate-limit.guard";
import { EventsService } from "./events.service";

@Controller("v1")
@UseGuards(RateLimitGuard)
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

  @Post("reports")
  @HttpCode(202)
  async report(
    @Body() body: unknown,
    @Headers("user-agent") userAgent: string | undefined,
  ): Promise<{ accepted: true }> {
    const parsed = sessionReportSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("malformed report");
    await this.events.report(parsed.data, userAgent);
    return { accepted: true };
  }
}
