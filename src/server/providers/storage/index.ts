import { getEnv } from "@/lib/env";
import type { StorageProvider } from "./storage-provider.interface";
import { S3StorageProvider } from "./s3-provider";
import { VercelBlobStorageProvider } from "./vercel-blob-provider";

export * from "./storage-provider.interface";

let cachedProvider: StorageProvider | null = null;

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
    default:
      cachedProvider = new S3StorageProvider();
  }

  return cachedProvider;
}
