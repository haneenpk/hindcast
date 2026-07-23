import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { Injectable } from "@nestjs/common";
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../env";

// S3 DeleteObjects caps each request at 1000 keys.
const DELETE_BATCH = 1000;

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

  /** Removes objects in batches. Deleting a missing key is a no-op, so
   *  the retention sweep can safely re-run over a half-finished cleanup. */
  async deleteObjects(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += DELETE_BATCH) {
      const batch = keys.slice(i, i + DELETE_BATCH);
      if (batch.length === 0) continue;
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: env.S3_BUCKET,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }
}
