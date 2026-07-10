import { z } from "zod";

/**
 * Central environment variable contract.
 *
 * Every external integration reads credentials ONLY from here.
 * Nothing in the codebase is allowed to read `process.env` directly
 * outside of this file — see repository README for the rule.
 *
 * Variables are split into:
 *  - required: app will not boot without them
 *  - optional: feature is disabled / falls back gracefully when absent
 *
 * This lets Phase A (no credentials) run in a degraded "not configured"
 * mode instead of crashing, while still never mocking real behavior.
 */

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // App
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Better Auth
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url(),

  // Google OAuth (Google Workspace login)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Microsoft OAuth (Microsoft 365 login)
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default("common"),

  // Magic Link email delivery
  // FIX-004: mandatory, no default — app fails to start until an explicit
  // choice is made ("none" is a valid, explicit choice; unset is not).
  EMAIL_PROVIDER: z.enum(["resend", "smtp", "none"], {
    error: () =>
      "EMAIL_PROVIDER is required. Set it to \"resend\", \"smtp\", or \"none\" (explicit opt-out) — there is no default.",
  }),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),

  // File storage (agency logos)
  // FIX-005: mandatory, no default — same rationale as EMAIL_PROVIDER.
  STORAGE_PROVIDER: z.enum(["s3", "vercel-blob", "none"], {
    error: () =>
      "STORAGE_PROVIDER is required. Set it to \"s3\", \"vercel-blob\", or \"none\" (explicit opt-out) — there is no default.",
  }),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Registration policy
  PERSONAL_EMAIL_DOMAINS: z
    .string()
    .default(
      "gmail.com,yahoo.com,outlook.com,hotmail.com,live.com,icloud.com,aol.com,proton.me,protonmail.com,zoho.com,mail.com,gmx.com,yandex.com,rediffmail.com",
    ),

  // Logging
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Validates and returns process.env against the schema above.
 * Throws a descriptive error at boot time if a REQUIRED variable is missing.
 * Optional variables are left undefined and callers must check for that
 * (see server/providers/* for the "not configured" adapter pattern).
 */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Fix these variables:\n${issues}`,
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Convenience flags for optional integrations. */
export function getIntegrationStatus(env: Env = getEnv()) {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    microsoft: Boolean(
      env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET,
    ),
    email: env.EMAIL_PROVIDER !== "none",
    storage: env.STORAGE_PROVIDER !== "none",
  };
}

export function getPersonalEmailDomains(env: Env = getEnv()): Set<string> {
  return new Set(
    env.PERSONAL_EMAIL_DOMAINS.split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  );
}
