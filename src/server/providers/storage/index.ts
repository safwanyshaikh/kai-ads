import { getEnv } from "@/lib/env";
import type { StorageProvider } from "./storage-provider.interface";
import { S3StorageProvider } from "./s3-provider";
import { VercelBlobStorageProvider } from "./vercel-blob-provider";
import { NullStorageProvider } from "./null-provider";

export * from "./storage-provider.interface";

let cachedProvider: StorageProvider | null = null;

/** FIX-005: no default, no silent fallback — STORAGE_PROVIDER is mandatory. */
export function getStorageProvider(): StorageProvider {
  if (cachedProvider) return cachedProvider;

  const env = getEnv();
  switch (env.STORAGE_PROVIDER) {
    case "vercel-blob":
      cachedProvider = new VercelBlobStorageProvider();
      break;
    case "s3":
      cachedProvider = new S3StorageProvider();
      break;
    case "none":
      cachedProvider = new NullStorageProvider();
      break;
  }

  return cachedProvider;
}
