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
  // Sprint 006: defaults raised from gpt-4.1-mini — extraction quality
  // drives every downstream stage (Truth Brain, Creative Director,
  // composition), and the mini model demonstrably collapsed a 19-line
  // division list into one "Various Positions" entry. Still overridable
  // per deployment via env.
  KAI_TEXT_MODEL: z.string().default("gpt-4.1"),
  KAI_VISION_MODEL: z.string().default("gpt-4.1"),

  // KAI Creative Engine (Sprint 004) — image generation. Same optional/
  // feature-gated pattern as the text engine above.
  KAI_IMAGE_MODEL: z.string().default("gpt-image-1"),
  // Sprint 006: "high" by default — the background is the single most
  // visible quality lever on a Visual ad. Overridable via env.
  KAI_IMAGE_QUALITY: z.enum(["low", "medium", "high"]).default("high"),
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

export interface AuthHostConfig {
  /** Host patterns (no protocol), fed directly to Better Auth's dynamic
   *  `baseURL.allowedHosts`. Supports `*` wildcards. Better Auth derives
   *  BOTH the per-request base URL AND the full trustedOrigins list from
   *  this one list — see resolveDynamicBaseURL / getTrustedOrigins in
   *  better-auth's own source. */
  allowedHosts: string[];
  /** Used ONLY when no request context exists (e.g. static generation at
   *  build time) — never served to real traffic, so it being imprecise
   *  has no user-facing effect. */
  fallback: string;
}

/**
 * Sprint 006 Bug 003: covers every `*.vercel.app` host — Preview or
 * Production, for THIS project specifically, since Vercel's own platform
 * routing (not this allowlist) is what decides whether a request with a
 * given Host ever reaches this deployment; an external request can never
 * spoof its way past that.
 *
 * Deliberately UNSCOPED (not e.g. "kai-ads-*.vercel.app"): Better Auth's
 * dynamic `baseURL` falls back to `fallback` not only when a request has
 * no discoverable Host, but ALSO whenever a request's real Host fails to
 * match every `allowedHosts` pattern — see `resolveDynamicBaseURL` in
 * better-auth's own source. A project-name-scoped wildcard is a guess
 * about this project's actual Vercel-assigned domain naming; if that
 * guess is wrong for even one real request, THAT SPECIFIC REQUEST falls
 * through to `fallback`, which chains down to `BETTER_AUTH_URL` if set —
 * reproducing the exact "https://api.example.com" incident live, for
 * real traffic, not just at build time. Matching the whole
 * `*.vercel.app` suffix removes the guess entirely.
 */
const VERCEL_HOST_WILDCARD = "*.vercel.app";

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Sprint 006 Bug 002: BETTER_AUTH_URL / APP_URL were used as THE
 * authoritative base URL / trusted-origin pair. A stale placeholder value
 * left in Vercel project settings ("https://api.example.com") therefore
 * silently became the URL used for every magic link and every Google
 * OAuth callback, on every environment — breaking sign-in with
 * "Invalid origin", broken magic-link URLs, and
 * "Error 400: redirect_uri_mismatch" on Google.
 *
 * Fix: never treat a manually-entered env var as THE url again. Instead,
 * build an allowlist of valid HOSTS (Vercel-supplied, always-current
 * values, plus a wildcard covering every deployment of this project) and
 * hand it to Better Auth's native dynamic `baseURL` config, which derives
 * the actual base URL — and, from it, every trusted origin — from the
 * REQUEST that is actually being served, every single time. A stray env
 * var can now, at worst, become one more harmless, never-matched entry in
 * an allowlist; it can never again become the value every deployment uses.
 *
 * An explicit BETTER_AUTH_URL/APP_URL is still honored as one additional
 * allowed host, but ONLY in Production (a legitimate custom-domain
 * escape hatch) — Preview must never depend on a manually entered URL.
 */
export function resolveAuthHostConfig(env: Env = getEnv()): AuthHostConfig {
  const hosts = new Set<string>();

  if (env.NODE_ENV !== "production") hosts.add("localhost:3000");

  if (env.VERCEL_URL) hosts.add(env.VERCEL_URL);
  if (env.VERCEL_BRANCH_URL) hosts.add(env.VERCEL_BRANCH_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) hosts.add(env.VERCEL_PROJECT_PRODUCTION_URL);
  hosts.add(VERCEL_HOST_WILDCARD);

  const isProductionDeployment =
    env.VERCEL_ENV === "production" || (!env.VERCEL_ENV && env.NODE_ENV === "production");
  if (isProductionDeployment) {
    // Guard against APP_URL's dev-only default ("http://localhost:3000")
    // leaking into the production allowlist when no real override is set.
    const explicitHost =
      hostOf(env.BETTER_AUTH_URL) ??
      (env.APP_URL && env.APP_URL !== "http://localhost:3000" ? hostOf(env.APP_URL) : null);
    if (explicitHost) hosts.add(explicitHost);
  }

  // Vercel-derived values first, so on Vercel the fallback never touches a
  // stale manually-entered value even in the one context where it would
  // be harmless anyway (no real request present).
  const fallback =
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ??
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null) ??
    env.BETTER_AUTH_URL ??
    env.APP_URL ??
    "http://localhost:3000";

  return { allowedHosts: [...hosts], fallback };
}

export function getPersonalEmailDomains(env: Env = getEnv()): Set<string> {
  return new Set(
    env.PERSONAL_EMAIL_DOMAINS.split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  );
}
