import { getStorageProvider } from "@/server/providers/storage";

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const ALLOWED_ADVERTISEMENT_SOURCE_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_ADVERTISEMENT_SOURCE_BYTES =
  15 * 1024 * 1024;

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
      throw new InvalidFileError(
        "Logo file must be smaller than 5MB.",
      );
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

  async uploadAdvertisementSource(file: {
    name: string;
    type: string;
    data: Buffer;
  }): Promise<{ url: string; key: string }> {
    if (
      !ALLOWED_ADVERTISEMENT_SOURCE_TYPES.has(
        file.type,
      )
    ) {
      throw new InvalidFileError(
        "File must be a PDF, DOCX, PNG, JPEG, or WEBP.",
      );
    }

    if (
      file.data.byteLength >
      MAX_ADVERTISEMENT_SOURCE_BYTES
    ) {
      throw new InvalidFileError(
        "File must be smaller than 15MB.",
      );
    }

    const provider = getStorageProvider();

    if (!provider.isConfigured) {
      throw new Error(
        "File storage is not configured yet. Set STORAGE_PROVIDER and its credentials.",
      );
    }

    return provider.upload({
      path: "advertisement-sources",
      fileName: file.name,
      contentType: file.type,
      data: file.data,
    });
  },

  /**
   * Generated advertisements are delivered as WEBP.
   *
   * The generation pipeline can still work internally with PNG buffers.
   * Storage receives the optimized WEBP so:
   *
   * - browser preview loads faster
   * - Vercel response is smaller
   * - storage transfer is smaller
   * - download is faster
   * - mobile users receive a much lighter file
   */
  async uploadGeneratedAdvertisement(file: {
    name: string;
    data: Buffer;
  }): Promise<{ url: string; key: string }> {
    const provider = getStorageProvider();

    if (!provider.isConfigured) {
      throw new Error(
        "File storage is not configured yet. Set STORAGE_PROVIDER and its credentials.",
      );
    }

    return provider.upload({
      path: "advertisement-generated",
      fileName: file.name.endsWith(".webp")
        ? file.name
        : file.name.replace(/\.[^.]+$/, "") +
          ".webp",
      contentType: "image/webp",
      data: file.data,
    });
  },
};
