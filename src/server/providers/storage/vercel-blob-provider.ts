import { put } from "@vercel/blob";
import { getEnv } from "@/lib/env";
import {
  StorageProviderNotConfiguredError,
  type StorageProvider,
  type UploadFileInput,
} from "./storage-provider.interface";

export class VercelBlobStorageProvider implements StorageProvider {
  readonly name = "vercel-blob";

  /**
   * Two supported connection modes, matching what @vercel/blob's put()
   * itself accepts (see resolveBlobAuth in @vercel/blob's source):
   *  - a static BLOB_READ_WRITE_TOKEN (classic token-based connection), or
   *  - BLOB_STORE_ID with no token — the project's Blob store is
   *    "Connected" via OIDC, and put() resolves the short-lived
   *    VERCEL_OIDC_TOKEN itself at call time when no `token` option is
   *    passed. Either variable being present means the store is usable.
   */
  get isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.BLOB_READ_WRITE_TOKEN) || Boolean(env.BLOB_STORE_ID);
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
      // Only pass an explicit token when one is configured; omitting the
      // key (rather than passing it as undefined) lets put() fall through
      // to its own OIDC resolution when only BLOB_STORE_ID is set.
      ...(env.BLOB_READ_WRITE_TOKEN ? { token: env.BLOB_READ_WRITE_TOKEN } : {}),
    });

    return { url: blob.url, key };
  }
}
