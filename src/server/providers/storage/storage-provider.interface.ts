export interface UploadFileInput {
  /** Folder-like key prefix, e.g. "agency-logos" */
  path: string;
  fileName: string;
  contentType: string;
  data: Buffer;
}

export interface StorageProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  upload(input: UploadFileInput): Promise<{ url: string; key: string }>;
}

export class StorageProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `Storage provider "${provider}" is not configured. Set the required environment variables before uploading files.`,
    );
    this.name = "StorageProviderNotConfiguredError";
  }
}
