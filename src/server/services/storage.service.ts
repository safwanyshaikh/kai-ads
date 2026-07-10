import { getStorageProvider } from "@/server/providers/storage";

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB

export class InvalidFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFileError";
  }
}

export const storageService = {
  get isConfigured(): boolean {
    return getStorageProvider().isConfigured;
  },

  async uploadAgencyLogo(file: {
    name: string;
    type: string;
    data: Buffer;
  }): Promise<{ url: string; key: string }> {
    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      throw new InvalidFileError(
        "Logo must be a PNG, JPEG, WEBP, or SVG image.",
      );
    }
    if (file.data.byteLength > MAX_LOGO_BYTES) {
      throw new InvalidFileError("Logo file must be smaller than 5MB.");
    }

    const provider = getStorageProvider();
    if (!provider.isConfigured) {
      throw new Error(
        "File storage is not configured yet. Set STORAGE_PROVIDER and its credentials.",
      );
    }

    return provider.upload({
      path: "agency-logos",
      fileName: file.name,
      contentType: file.type,
      data: file.data,
    });
  },
};
