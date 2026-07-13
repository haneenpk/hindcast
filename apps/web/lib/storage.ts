import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const gunzipAsync = promisify(gunzip);

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY must be set");
  }
  client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return client;
}

/** Reads one gzipped chunk back into its array of rrweb events. */
export async function readChunkEvents(storageKey: string): Promise<unknown[]> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET must be set");
  const result = await s3().send(
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
  );
  if (!result.Body) return [];
  const compressed = Buffer.from(await result.Body.transformToByteArray());
  const parsed: unknown = JSON.parse((await gunzipAsync(compressed)).toString());
  return Array.isArray(parsed) ? parsed : [];
}
