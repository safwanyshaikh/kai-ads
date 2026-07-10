import { getEnv } from "@/lib/env";
import type { EmailProvider } from "./email-provider.interface";
import { ResendEmailProvider } from "./resend-provider";
import { SmtpEmailProvider } from "./smtp-provider";

export * from "./email-provider.interface";

let cachedProvider: EmailProvider | null = null;

/**
 * Returns the configured EmailProvider based on EMAIL_PROVIDER env var.
 * Throws only when .send() is actually called without credentials —
 * the factory itself never throws so the app can boot in Phase A.
 */
export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  const env = getEnv();
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      cachedProvider = new ResendEmailProvider();
      break;
    case "smtp":
      cachedProvider = new SmtpEmailProvider();
      break;
    default:
      // No provider selected — default to Resend adapter (most common),
      // it will correctly report isConfigured = false until env is set.
      cachedProvider = new ResendEmailProvider();
  }

  return cachedProvider;
}
