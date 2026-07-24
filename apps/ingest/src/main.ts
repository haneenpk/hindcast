import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { json } from "express";
import { AppModule } from "./app.module";
import { env } from "./env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // SDK batches arrive as text/plain so browsers skip the CORS preflight;
  // parse JSON no matter what content type the sender picked. Oversized
  // bodies are refused with a 413 here, before any work happens.
  app.use(json({ type: () => true, limit: env.MAX_BATCH_BYTES }));

  // A recorder embeds on customer sites whose domains we don't know ahead
  // of time, and the project key — not the origin — is what authenticates
  // a batch. So any origin may post, but never with credentials: there is
  // no cookie or session to ride along, and reflecting "*" with creds
  // would be the classic CORS hole. Preflights (rare, since batches are
  // text/plain) are cached for a day.
  app.enableCors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
    maxAge: 86_400,
  });

  await app.listen(env.PORT);
}

void bootstrap();
