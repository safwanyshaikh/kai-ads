import { z } from "zod";

/**
 * Permanent production identity of KAI Ads.
 *
 * This is the canonical URL users should use.
 * Deployment-specific *.vercel.app URLs are never the application's
 * permanent identity.
 */
export const KAI_CANONICAL_URL =
  "https://kai-ads.vercel.app";

export const KAI_CANONICAL_HOST =
  "kai-ads.vercel.app";

/**
 * Central environment variable contract.
 *
 * Every external integration reads credentials ONLY from here.
 *
 * Variables are split into:
 *  - required: app will not boot without them
 *  - optional: feature is disabled / falls back gracefully when absent
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum([
      "development",
      "production",
      "test",
    ])
    .default("development"),

  // App
  APP_URL: z
    .string()
    .url()
    .default(
      KAI_CANONICAL_URL,
    ),

  // Database
  DATABASE_URL: z
    .string()
    .min(
      1,
      "DATABASE_URL is required",
    ),

  // Better Auth
  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      "BETTER_AUTH_SECRET must be at least 32 characters",
    ),

  /**
   * Explicit production canonical URL.
   *
   * Still optional because Vercel supplies its own runtime URL data.
   * The auth resolver below always prefers the permanent KAI URL.
   */
  BETTER_AUTH_URL: z
    .string()
    .url()
    .optional(),

  // Vercel platform system variables
  VERCEL_ENV: z
    .enum([
      "production",
      "preview",
      "development",
    ])
    .optional(),

  VERCEL_URL:
    z.string().optional(),

  VERCEL_BRANCH_URL:
    z.string().optional(),

  VERCEL_PROJECT_PRODUCTION_URL:
    z.string().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID:
    z.string().optional(),

  GOOGLE_CLIENT_SECRET:
    z.string().optional(),

  // Microsoft OAuth
  MICROSOFT_CLIENT_ID:
    z.string().optional(),

  MICROSOFT_CLIENT_SECRET:
    z.string().optional(),

  MICROSOFT_TENANT_ID:
    z
      .string()
      .default("common"),

  // Magic Link email delivery
  EMAIL_PROVIDER:
    z.enum(
      [
        "resend",
        "smtp",
        "none",
      ],
      {
        error: () =>
          "EMAIL_PROVIDER is required. Set it to \"resend\", \"smtp\", or \"none\" (explicit opt-out) — there is no default.",
      },
    ),

  RESEND_API_KEY:
    z.string().optional(),

  EMAIL_FROM:
    z
      .string()
      .email()
      .optional(),

  SMTP_HOST:
    z.string().optional(),

  SMTP_PORT:
    z.coerce
      .number()
      .optional(),

  SMTP_USER:
    z.string().optional(),

  SMTP_PASSWORD:
    z.string().optional(),

  SMTP_SECURE:
    z.coerce
      .boolean()
      .optional(),

  // File storage
  STORAGE_PROVIDER:
    z.enum(
      [
        "s3",
        "vercel-blob",
        "none",
      ],
      {
        error: () =>
          "STORAGE_PROVIDER is required. Set it to \"s3\", \"vercel-blob\", or \"none\" (explicit opt-out) — there is no default.",
      },
    ),

  STORAGE_BUCKET:
    z.string().optional(),

  STORAGE_REGION:
    z.string().optional(),

  STORAGE_ACCESS_KEY_ID:
    z.string().optional(),

  STORAGE_SECRET_ACCESS_KEY:
    z.string().optional(),

  STORAGE_ENDPOINT:
    z.string().optional(),

  STORAGE_PUBLIC_URL:
    z.string().optional(),

  BLOB_READ_WRITE_TOKEN:
    z.string().optional(),

  BLOB_STORE_ID:
    z.string().optional(),

  // Registration policy
  PERSONAL_EMAIL_DOMAINS:
    z
      .string()
      .default(
        "gmail.com,yahoo.com,outlook.com,hotmail.com,live.com,icloud.com,aol.com,proton.me,protonmail.com,zoho.com,mail.com,gmx.com,yandex.com,rediffmail.com",
      ),

  // KAI Intelligence Engine
  OPENAI_API_KEY:
    z.string().optional(),

  KAI_TEXT_MODEL:
    z
      .string()
      .default(
        "gpt-4.1",
      ),

  KAI_VISION_MODEL:
    z
      .string()
      .default(
        "gpt-4.1",
      ),

  // Gemini
  GEMINI_TEXT_API_KEY:
    z.string().optional(),

  GEMINI_IMAGE_API_KEY:
    z.string().optional(),

  // KAI Creative Engine
  KAI_OPENAI_TIMEOUT_MS:
    z.coerce
      .number()
      .int()
      .positive()
      .default(
        240000,
      ),

  KAI_OPENAI_MAX_RETRIES:
    z.coerce
      .number()
      .int()
      .min(0)
      .max(3)
      .default(1),

  KAI_IMAGE_MODEL:
    z
      .string()
      .default(
        "gpt-image-1",
      ),

  KAI_IMAGE_QUALITY:
    z
      .enum([
        "low",
        "medium",
        "high",
      ])
      .default("high"),

  KAI_IMAGE_SIZE:
    z
      .string()
      .default(
        "1024x1024",
      ),

  /**
   * Permanent public identity used by KAI verification QR codes.
   *
   * Store the HOST, not a deployment URL.
   */
  KAI_PUBLIC_DOMAIN:
    z
      .string()
      .default(
        KAI_CANONICAL_HOST,
      ),

  // Bootstrap Trial Quota / Cost Control
  AI_KILL_SWITCH:
    z.coerce
      .boolean()
      .default(false),

  AI_DAILY_BUDGET_USD:
    z.coerce
      .number()
      .positive()
      .default(50),

  // Logging
  LOG_LEVEL:
    z
      .enum([
        "fatal",
        "error",
        "warn",
        "info",
        "debug",
        "trace",
      ])
      .default("info"),
});

export type Env =
  z.infer<
    typeof envSchema
  >;

let cachedEnv:
  Env | null = null;

/**
 * Validates and returns process.env against the schema above.
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed =
    envSchema.safeParse(
      process.env,
    );

  if (!parsed.success) {
    const issues =
      parsed.error.issues
        .map(
          (issue) =>
            `  - ${issue.path.join(
              ".",
            )}: ${issue.message}`,
        )
        .join("\n");

    throw new Error(
      `Invalid environment configuration. Fix these variables:\n${issues}`,
    );
  }

  cachedEnv =
    parsed.data;

  return cachedEnv;
}

/**
 * Convenience flags for optional integrations.
 */
export function getIntegrationStatus(
  env: Env = getEnv(),
) {
  return {
    google: Boolean(
      env.GOOGLE_CLIENT_ID &&
        env.GOOGLE_CLIENT_SECRET,
    ),

    microsoft: Boolean(
      env.MICROSOFT_CLIENT_ID &&
        env.MICROSOFT_CLIENT_SECRET,
    ),

    email:
      env.EMAIL_PROVIDER !==
      "none",

    storage:
      env.STORAGE_PROVIDER !==
      "none",

    openai: Boolean(
      env.OPENAI_API_KEY,
    ),

    geminiText: Boolean(
      env.GEMINI_TEXT_API_KEY,
    ),

    geminiImage: Boolean(
      env.GEMINI_IMAGE_API_KEY,
    ),
  };
}

export interface AuthHostConfig {
  /**
   * Host patterns accepted by Better Auth.
   */
  allowedHosts: string[];

  /**
   * Fallback used when no request context exists.
   */
  fallback: string;
}

/**
 * All Vercel deployments remain valid request hosts.
 *
 * The permanent production identity is added explicitly below.
 */
const VERCEL_HOST_WILDCARD =
  "*.vercel.app";

function hostOf(
  url:
    | string
    | undefined,
): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(
      url,
    ).host;
  } catch {
    return null;
  }
}

/**
 * Resolve the Better Auth host configuration.
 *
 * Permanent production identity:
 *
 *     https://kai-ads.vercel.app
 *
 * Deployment-specific Vercel URLs are still allowed for active
 * deployment traffic, but they are NOT used as the application's
 * permanent identity.
 */
export function resolveAuthHostConfig(
  env: Env = getEnv(),
): AuthHostConfig {
  const hosts =
    new Set<string>();

  if (
    env.NODE_ENV !==
    "production"
  ) {
    hosts.add(
      "localhost:3000",
    );
  }

  /**
   * PERMANENT KAI ADS DOMAIN
   */
  hosts.add(
    KAI_CANONICAL_HOST,
  );

  /**
   * Current Vercel deployment URLs remain accepted for active traffic.
   */
  if (env.VERCEL_URL) {
    hosts.add(
      env.VERCEL_URL,
    );
  }

  if (
    env.VERCEL_BRANCH_URL
  ) {
    hosts.add(
      env.VERCEL_BRANCH_URL,
    );
  }

  if (
    env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    hosts.add(
      env.VERCEL_PROJECT_PRODUCTION_URL,
    );
  }

  hosts.add(
    VERCEL_HOST_WILDCARD,
  );

  /**
   * Explicit custom production host, if configured.
   */
  const isProductionDeployment =
    env.VERCEL_ENV ===
      "production" ||
    (!env.VERCEL_ENV &&
      env.NODE_ENV ===
        "production");

  if (
    isProductionDeployment
  ) {
    const explicitHost =
      hostOf(
        env.BETTER_AUTH_URL,
      ) ??
      (env.APP_URL &&
      env.APP_URL !==
        "http://localhost:3000"
        ? hostOf(
            env.APP_URL,
          )
        : null);

    if (
      explicitHost
    ) {
      hosts.add(
        explicitHost,
      );
    }
  }

  /**
   * IMPORTANT:
   *
   * Production prefers Vercel's own stable production-project host
   * (VERCEL_PROJECT_PRODUCTION_URL) — that is the project's real served
   * domain, not an ephemeral deployment URL — over both a manually-set
   * BETTER_AUTH_URL (which is easy to leave stale/pointed at a
   * placeholder — see the test with that exact name) and the generic
   * KAI_CANONICAL_URL constant, which is only the last-resort default
   * for a production deployment that hasn't told us its real host at
   * all.
   *
   * It does NOT fall back to a temporary Vercel deployment URL
   * (VERCEL_URL / VERCEL_BRANCH_URL) — those change on every deploy.
   */
  const fallback =
    isProductionDeployment
      ? env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
        : KAI_CANONICAL_URL
      : env.BETTER_AUTH_URL ??
        env.APP_URL ??
        "http://localhost:3000";

  return {
    allowedHosts:
      [...hosts],

    fallback,
  };
}

export function getPersonalEmailDomains(
  env: Env = getEnv(),
): Set<string> {
  return new Set(
    env.PERSONAL_EMAIL_DOMAINS
      .split(",")
      .map(
        (domain) =>
          domain
            .trim()
            .toLowerCase(),
      )
      .filter(Boolean),
  );
}
