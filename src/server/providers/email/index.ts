import { getEnv } from "@/lib/env";
import type { EmailProvider } from "./email-provider.interface";
import { ResendEmailProvider } from "./resend-provider";
import { SmtpEmailProvider } from "./smtp-provider";
import { NullEmailProvider } from "./null-provider";

export * from "./email-provider.interface";

let cachedProvider: EmailProvider | null = null;

/**
 * Returns the configured EmailProvider based on the mandatory
 * EMAIL_PROVIDER env var (FIX-004: no default, no silent fallback).
 * Throws only when .send() is actually called without credentials —
 * selecting a provider never throws, so the app can still boot.
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
    case "none":
      cachedProvider = new NullEmailProvider();
      break;
  }

  return cachedProvider;
}
