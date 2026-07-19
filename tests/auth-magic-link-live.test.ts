import { describe, expect, it } from "vitest";
import { getTestInstance } from "better-auth/test";
import { magicLink } from "better-auth/plugins";
import { resolveAuthHostConfig, type Env } from "@/lib/env";

/**
 * Sprint 006 Bug 003: resolveAuthHostConfig() unit tests (auth-origin-
 * resolution.test.ts) prove the ALLOWLIST is correct, but Better Auth's
 * dynamic baseURL has a second failure mode unit tests can't see: it
 * silently falls back to `fallback` whenever a real request's Host fails
 * to match every allowedHosts pattern — not only when there's no request
 * at all. These tests run resolveAuthHostConfig()'s ACTUAL output through
 * a REAL, running Better Auth instance (better-auth's own getTestInstance,
 * sqlite-backed) and a REAL HTTP request, to prove the full pipeline —
 * not just the config object — never leaks a stray env var into a
 * generated magic-link URL.
 */

function fullEnv(overrides: Partial<Env>): Env {
  return {
    NODE_ENV: "production",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://test:test@localhost:5432/kai_ads_test",
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-32",
    BETTER_AUTH_URL: undefined,
    VERCEL_ENV: undefined,
    VERCEL_URL: undefined,
    VERCEL_BRANCH_URL: undefined,
    VERCEL_PROJECT_PRODUCTION_URL: undefined,
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    MICROSOFT_CLIENT_ID: undefined,
    MICROSOFT_CLIENT_SECRET: undefined,
    MICROSOFT_TENANT_ID: "common",
    EMAIL_PROVIDER: "none",
    RESEND_API_KEY: undefined,
    EMAIL_FROM: undefined,
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_USER: undefined,
    SMTP_PASSWORD: undefined,
    SMTP_SECURE: undefined,
    STORAGE_PROVIDER: "none",
    STORAGE_BUCKET: undefined,
    STORAGE_REGION: undefined,
    STORAGE_ACCESS_KEY_ID: undefined,
    STORAGE_SECRET_ACCESS_KEY: undefined,
    STORAGE_ENDPOINT: undefined,
    STORAGE_PUBLIC_URL: undefined,
    BLOB_READ_WRITE_TOKEN: undefined,
    BLOB_STORE_ID: undefined,
    PERSONAL_EMAIL_DOMAINS: "gmail.com",
    OPENAI_API_KEY: undefined,
    KAI_TEXT_MODEL: "gpt-4.1-mini",
    KAI_VISION_MODEL: "gpt-4.1-mini",
    KAI_IMAGE_MODEL: "gpt-image-1",
    KAI_IMAGE_QUALITY: "medium",
    KAI_IMAGE_SIZE: "1024x1024",
    KAI_PUBLIC_DOMAIN: "http://localhost:3000",
    AI_KILL_SWITCH: false,
    AI_DAILY_BUDGET_USD: 50,
    CREATIVE_BRAIN_BACKGROUND_BRIEF: false,
    CREATIVE_DIRECTOR_BRAIN: false,
    LOG_LEVEL: "info",
    ...overrides,
  };
}

async function traceMagicLink(host: string, allowedHosts: string[], fallback: string) {
  let capturedUrl: string | null = null;
  const { auth } = await getTestInstance(
    {
      baseURL: { allowedHosts, fallback },
      plugins: [
        magicLink({
          expiresIn: 60 * 15,
          sendMagicLink: async ({ url }) => {
            capturedUrl = url;
          },
        }),
      ],
    },
    { disableTestUser: true },
  );
  const request = new Request(`https://${host}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json", host, origin: `https://${host}` },
    body: JSON.stringify({ email: "jobs@alyousufent.com", callbackURL: "/dashboard" }),
  });
  await auth.handler(request);
  return capturedUrl;
}

describe("Live magic-link URL generation through resolveAuthHostConfig()'s real output", () => {
  it("a Preview host with NO project-name assumption still resolves correctly (Bug 003)", async () => {
    const env = fullEnv({
      VERCEL_ENV: "preview",
      BETTER_AUTH_URL: "https://api.example.com", // the exact incident value
      // VERCEL_URL/VERCEL_BRANCH_URL deliberately absent — simulates
      // Vercel system env var exposure being unavailable to the runtime.
    });
    const { allowedHosts, fallback } = resolveAuthHostConfig(env);
    const url = await traceMagicLink(
      "totally-unpredictable-project-slug-42.vercel.app",
      allowedHosts,
      fallback,
    );
    expect(url).not.toBeNull();
    expect(url).not.toContain("api.example.com");
    expect(url).toContain("totally-unpredictable-project-slug-42.vercel.app");
  });

  it("a Production host with the exact incident BETTER_AUTH_URL never leaks it into the magic-link URL", async () => {
    const env = fullEnv({
      VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://api.example.com",
      VERCEL_PROJECT_PRODUCTION_URL: "kai-ads-production.vercel.app",
    });
    const { allowedHosts, fallback } = resolveAuthHostConfig(env);
    const url = await traceMagicLink("kai-ads-production.vercel.app", allowedHosts, fallback);
    expect(url).not.toBeNull();
    expect(url).not.toContain("api.example.com");
    expect(url).toContain("kai-ads-production.vercel.app");
  });

  it("local dev resolves to localhost, not any placeholder", async () => {
    const env = fullEnv({ NODE_ENV: "development" });
    const { allowedHosts, fallback } = resolveAuthHostConfig(env);
    const url = await traceMagicLink("localhost:3000", allowedHosts, fallback);
    expect(url).not.toBeNull();
    expect(url).toContain("localhost:3000");
  });
});
