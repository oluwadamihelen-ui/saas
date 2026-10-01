import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { StorageProvider } from "./index";

export interface S3Config {
  bucket: string;
  endpoint?: string; // R2: https://<account-id>.r2.cloudflarestorage.com ; MinIO: http://localhost:9000
  region: string; // R2 uses "auto"
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

/** S3-compatible storage: AWS S3, Cloudflare R2, MinIO, Backblaze B2, Supabase Storage (S3 endpoint)... */
export class S3Storage implements StorageProvider {
  private client: S3Client;
  constructor(private cfg: S3Config, client?: S3Client) {
    this.client =
      client ??
      new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        forcePathStyle: cfg.forcePathStyle ?? !!cfg.endpoint,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
        // R2 and most S3-compatible stores reject the SDK's default trailing-checksum streaming upload.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      });
  }
  async put(key: string, data: Buffer, mimeType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: data, ContentType: mimeType, ContentLength: data.length }));
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    if (!res.Body) throw new Error("Empty object");
    return Buffer.from(await res.Body.transformToByteArray());
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }
}

export function s3ConfigFromEnv(provider: "s3" | "r2", env: NodeJS.ProcessEnv = process.env): S3Config {
  const bucket = env.STORAGE_BUCKET;
  const accessKeyId = env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(`STORAGE_PROVIDER=${provider} needs STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY`);
  }
  if (provider === "r2" && !env.STORAGE_ENDPOINT) throw new Error("STORAGE_PROVIDER=r2 needs STORAGE_ENDPOINT (https://<account-id>.r2.cloudflarestorage.com)");
  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: env.STORAGE_ENDPOINT || undefined,
    region: env.STORAGE_REGION || (provider === "r2" ? "auto" : "us-east-1"),
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === "true" ? true : undefined,
  };
}
