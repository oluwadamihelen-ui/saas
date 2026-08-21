import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "@cinerra/config";

export interface StorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  /** CDN or public base URL served in front of the bucket, if any (spec §40). */
  publicBaseUrl?: string;
}

/**
 * Thin, provider-agnostic wrapper around any S3-compatible object store
 * (AWS S3 in production, MinIO in local dev, Cloudflare R2/GCS via their
 * S3-compatible endpoints). Nothing outside this package touches an S3 SDK
 * directly — spec §38, §40.
 */
export class StorageClient {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;

  constructor(options: StorageOptions) {
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async putObject(key: string, body: Uint8Array | Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Signed, time-limited GET URL — used when no CDN is configured. */
  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    }
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresInSeconds });
  }

  /** Signed, time-limited PUT URL for direct browser uploads. */
  async getSignedUploadUrl(key: string, contentType: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: expiresInSeconds,
    });
  }

  /**
   * Downloads a (typically ephemeral, provider-hosted) URL and persists it
   * to durable storage. Every AI provider result MUST pass through this
   * before being referenced from the database — provider URLs are never
   * served to end users directly (spec §24, §40).
   */
  async downloadAndStore(sourceUrl: string, key: string, contentType: string): Promise<{ key: string; bytes: number }> {
    let buffer: Buffer;
    if (sourceUrl.startsWith("data:")) {
      const base64 = sourceUrl.split(",")[1] ?? "";
      buffer = Buffer.from(base64, "base64");
    } else {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to download generated asset from provider (${response.status}).`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
    }
    await this.putObject(key, buffer, contentType);
    return { key, bytes: buffer.byteLength };
  }
}

export function createStorageClient(env: Env): StorageClient {
  return new StorageClient({
    bucket: env.STORAGE_BUCKET,
    region: env.STORAGE_REGION,
    endpoint: env.STORAGE_ENDPOINT,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
  });
}

/**
 * Canonical object key layout: projects/{projectId}/{assetKind}/{assetId}.{ext}
 * Keeping this in one place means every writer (worker, upload endpoint,
 * export pipeline) produces keys the media library can predictably list.
 */
export function buildAssetKey(params: { projectId: string; kind: string; assetId: string; ext: string }): string {
  const kind = params.kind.toLowerCase().replace(/_/g, "-");
  return `projects/${params.projectId}/${kind}/${params.assetId}.${params.ext}`;
}
