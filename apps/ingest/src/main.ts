import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { json } from "express";
import { AppModule } from "./app.module";
import { env } from "./env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // SDK batches arrive as text/plain so browsers skip the CORS preflight;
  // parse JSON no matter what content type the sender picked.
  app.use(json({ type: () => true, limit: "5mb" }));

  // Recorders post from arbitrary customer origins with no credentials.
  // Per-project origin allowlists come with the hardening pass.
  app.enableCors({ origin: "*", methods: ["GET", "POST"] });

  await app.listen(env.PORT);
}

void bootstrap();
