import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { RateLimiterService } from "./rate-limiter.service";

// Runs after the JSON body is parsed, so the project key is available to
// key the limit on. A body without a key is let through — schema
// validation will reject it with a 400 a moment later.
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly limiter: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as { key?: unknown } | undefined;
    const key = typeof body?.key === "string" ? body.key : "";
    if (!key) return true;

    const verdict = await this.limiter.hit(key);
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader("x-ratelimit-remaining", String(verdict.remaining));
    if (!verdict.allowed) {
      response.setHeader("retry-after", String(verdict.resetSeconds));
      throw new HttpException(
        "rate limit exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
