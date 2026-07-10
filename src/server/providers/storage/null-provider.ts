import type { StorageProvider, UploadFileInput } from "./storage-provider.interface";

/** Used when STORAGE_PROVIDER=none is explicitly chosen. See email/null-provider.ts for rationale. */
export class NullStorageProvider implements StorageProvider {
  readonly name = "none";
  readonly isConfigured = false;

  async upload(_input: UploadFileInput): Promise<{ url: string; key: string }> {
    throw new Error(
      'File storage is disabled (STORAGE_PROVIDER=none). Set STORAGE_PROVIDER to "s3" or "vercel-blob" with its credentials to enable it.',
    );
  }
}
