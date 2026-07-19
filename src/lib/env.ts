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
  // Sprint 006 Bug 001: optional, not defaulted. On Vercel the effective
  // base URL/trusted origins are derived per-deployment from the VERCEL_*
  // system vars below (see resolveAuthUrls()) — a single static
  // BETTER_AUTH_URL cannot match every Preview deployment's unique domain.
  // Still honored as an explicit override when set (e.g. a custom
  // production domain Vercel doesn't already know about); required
  // outside Vercel via the https:// runtime check in auth.ts.
  BETTER_AUTH_URL: z.string().url().optional(),

  // Vercel platform — system environment variables Vercel injects
  // automatically at build and runtime; never set these manually. Used
  // only to resolve the correct Better Auth base URL / trusted origins per
  // deployment (see resolveAuthUrls() below).
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),

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
  // Set automatically by Vercel when a Blob store is "Connected" to the
  // project via OIDC (no static token issued). @vercel/blob's put()
  // resolves auth itself in that case, via VERCEL_OIDC_TOKEN + this store
  // id — see VercelBlobStorageProvider.
  BLOB_STORE_ID: z.string().optional(),

  // Registration policy
  PERSONAL_EMAIL_DOMAINS: z
    .string()
    .default(
      "gmail.com,yahoo.com,outlook.com,hotmail.com,live.com,icloud.com,aol.com,proton.me,protonmail.com,zoho.com,mail.com,gmx.com,yandex.com,rediffmail.com",
    ),

  // KAI Intelligence Engine (Sprint 003) — optional at boot, same pattern
  // as Google/Microsoft OAuth: the feature is unavailable without these,
  // but the app still starts. Model names are never hardcoded anywhere
  // else in the codebase — every AI call resolves them from here.
  OPENAI_API_KEY: z.string().optional(),
  KAI_TEXT_MODEL: z.string().default("gpt-4.1-mini"),
  KAI_VISION_MODEL: z.string().default("gpt-4.1-mini"),

  // KAI Creative Engine (Sprint 004) — image generation. Same optional/
  // feature-gated pattern as the text engine above.
  KAI_IMAGE_MODEL: z.string().default("gpt-image-1"),
  KAI_IMAGE_QUALITY: z.enum(["low", "medium", "high"]).default("medium"),
  KAI_IMAGE_SIZE: z.string().default("1024x1024"),

  // Public domain the unified verification QR badge points at
  // (https://{KAI_PUBLIC_DOMAIN}/v/{agencyVerificationId}?a={advertisementId}).
  KAI_PUBLIC_DOMAIN: z.string().default("http://localhost:3000"),

  // Bootstrap Trial Quota / Cost Control (Sprint 004)
  AI_KILL_SWITCH: z.coerce.boolean().default(false),
  AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(50),

  // Feature flag — route the GPT background prompt through the new
  // Creative-Brain-driven generator instead of legacy buildImageBrief().
  // Default OFF: production is byte-for-byte identical until explicitly
  // enabled. See src/server/generation/background-brief/.
  CREATIVE_BRAIN_BACKGROUND_BRIEF: z.coerce.boolean().default(false),

  // Feature flag — Sprint 006 Creative Director Brain (deterministic
  // intelligence layer). Default OFF: the brain is built and tested but NOT
  // wired into the production pipeline. See
  // src/server/generation/creative-director/.
  CREATIVE_DIRECTOR_BRAIN: z.coerce.boolean().default(false),

  // Logging
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

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
    openai: Boolean(env.OPENAI_API_KEY),
  };
}

/** Feature flags (default-off toggles that do not gate an integration). */
export function getFeatureFlags(env: Env = getEnv()) {
  return {
    creativeBrainBackgroundBrief: env.CREATIVE_BRAIN_BACKGROUND_BRIEF,
    creativeDirectorBrain: env.CREATIVE_DIRECTOR_BRAIN,
  };
}

export interface ResolvedAuthUrls {
  /** The origin Better Auth treats as itself — baseURL and OAuth callback construction. */
  baseUrl: string;
  /** Every origin a browser request may legitimately arrive from for this deployment. */
  trustedOrigins: string[];
}

/**
 * Sprint 006 Bug 001: Better Auth's `trustedOrigins` was a static
 * `[APP_URL, BETTER_AUTH_URL]` pair. Every Vercel Preview deployment gets
 * its own unique, unpredictable domain, so only whichever single URL
 * happened to be pinned in Vercel project settings ever passed Better
 * Auth's origin check — every other Preview deployment failed sign-in
 * with "Invalid origin".
 *
 * Vercel injects deployment-specific system env vars at build and runtime
 * (`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`,
 * `VERCEL_PROJECT_PRODUCTION_URL`); this derives the correct base URL and
 * the full set of trusted origins from them, on every deployment,
 * automatically — no per-preview manual configuration.
 *
 * `baseUrl` prefers `VERCEL_BRANCH_URL` over `VERCEL_URL` on Preview: the
 * branch alias is stable across every push to a branch, so it is the one
 * Preview URL that can actually be pre-registered as a Google OAuth
 * redirect URI. `VERCEL_URL` changes on every single deployment and can
 * never be pre-registered with an OAuth provider.
 *
 * An explicit `BETTER_AUTH_URL` always wins (e.g. a custom production
 * domain Vercel doesn't already know about, or any non-Vercel host).
 */
const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/localhost(:\d+)?$/;

export function resolveAuthUrls(env: Env = getEnv()): ResolvedAuthUrls {
  const origins = new Set<string>();

  if (env.APP_URL) origins.add(env.APP_URL);

  const vercelUrl = env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null;
  const branchUrl = env.VERCEL_BRANCH_URL ? `https://${env.VERCEL_BRANCH_URL}` : null;
  const prodUrl = env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null;
  for (const origin of [vercelUrl, branchUrl, prodUrl]) {
    if (origin) origins.add(origin);
  }

  const baseUrl =
    env.BETTER_AUTH_URL ??
    (env.VERCEL_ENV === "production" ? prodUrl : null) ??
    (env.VERCEL_ENV === "preview" ? (branchUrl ?? vercelUrl) : null) ??
    vercelUrl ??
    env.APP_URL ??
    "http://localhost:3000";

  origins.add(baseUrl);

  // Invariant, not an incidental default: localhost is never a trusted
  // origin in production, regardless of where it entered the set (e.g.
  // APP_URL left at its localhost default because a Vercel deployment,
  // correctly, never needed to override it).
  if (env.NODE_ENV === "production") {
    for (const origin of origins) {
      if (LOCALHOST_ORIGIN_PATTERN.test(origin)) origins.delete(origin);
    }
  } else {
    origins.add("http://localhost:3000");
  }

  return { baseUrl, trustedOrigins: [...origins] };
}

export function getPersonalEmailDomains(env: Env = getEnv()): Set<string> {
  return new Set(
    env.PERSONAL_EMAIL_DOMAINS.split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  );
}
