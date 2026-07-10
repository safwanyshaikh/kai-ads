import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/env";
import {
  StorageProviderNotConfiguredError,
  type StorageProvider,
  type UploadFileInput,
} from "./storage-provider.interface";

/** Works with AWS S3 or any S3-compatible provider (Cloudflare R2, MinIO, etc). */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";

  get isConfigured(): boolean {
    const env = getEnv();
    return Boolean(
      env.STORAGE_BUCKET && env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY,
    );
  }

  private client(): S3Client {
    const env = getEnv();
    return new S3Client({
      region: env.STORAGE_REGION ?? "auto",
      endpoint: env.STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(input: UploadFileInput): Promise<{ url: string; key: string }> {
    const env = getEnv();
    if (!this.isConfigured) {
      throw new StorageProviderNotConfiguredError(this.name);
    }

    const key = `${input.path}/${Date.now()}-${input.fileName}`;
    await this.client().send(
      new PutObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: key,
        Body: input.data,
        ContentType: input.contentType,
      }),
    );

    const publicBase = env.STORAGE_PUBLIC_URL ?? env.STORAGE_ENDPOINT ?? "";
    return { url: `${publicBase.replace(/\/$/, "")}/${key}`, key };
  }
}
