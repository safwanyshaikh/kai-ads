import { put } from "@vercel/blob";
import { getEnv } from "@/lib/env";
import {
  StorageProviderNotConfiguredError,
  type StorageProvider,
  type UploadFileInput,
} from "./storage-provider.interface";

export class VercelBlobStorageProvider implements StorageProvider {
  readonly name = "vercel-blob";

  get isConfigured(): boolean {
    return Boolean(getEnv().BLOB_READ_WRITE_TOKEN);
  }

  async upload(input: UploadFileInput): Promise<{ url: string; key: string }> {
    const env = getEnv();
    if (!this.isConfigured) {
      throw new StorageProviderNotConfiguredError(this.name);
    }

    const key = `${input.path}/${Date.now()}-${input.fileName}`;
    const blob = await put(key, input.data, {
      access: "public",
      contentType: input.contentType,
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    return { url: blob.url, key };
  }
}
