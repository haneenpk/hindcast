import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { Injectable } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

const gzipAsync = promisify(gzip);

@Injectable()
export class StorageService {
  private readonly client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    // MinIO serves buckets by path, not by subdomain.
    forcePathStyle: true,
  });

  /** Gzips the payload, stores it, returns the compressed size in bytes. */
  async putGzippedJson(key: string, payload: unknown): Promise<number> {
    const body = await gzipAsync(JSON.stringify(payload));
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: "application/json",
        ContentEncoding: "gzip",
      }),
    );
    return body.byteLength;
  }
}
