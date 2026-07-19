import { describe, expect, it } from "vitest";
import { resolveAuthUrls, type Env } from "@/lib/env";

/**
 * Sprint 006 Bug 001: Better Auth's trustedOrigins was a static
 * [APP_URL, BETTER_AUTH_URL] pair, so every Vercel Preview deployment
 * (each gets its own unique domain) failed sign-in with "Invalid origin".
 * These tests verify resolveAuthUrls() correctly derives the base URL and
 * trusted origins for every deployment context: local dev, every Vercel
 * Preview deployment, and Production.
 */

const BASE_ENV: Env = {
  NODE_ENV: "development",
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
};

describe("resolveAuthUrls — localhost (local dev)", () => {
  it("uses APP_URL as baseUrl and trusts localhost when no Vercel context exists", () => {
    const { baseUrl, trustedOrigins } = resolveAuthUrls(BASE_ENV);
    expect(baseUrl).toBe("http://localhost:3000");
    expect(trustedOrigins).toContain("http://localhost:3000");
  });
});

describe("resolveAuthUrls — Vercel Preview deployments", () => {
  it("prefers the stable VERCEL_BRANCH_URL as baseUrl (registrable OAuth redirect URI)", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "kai-ads-abc123-team.vercel.app",
      VERCEL_BRANCH_URL: "kai-ads-git-feature-branch-team.vercel.app",
    };
    const { baseUrl, trustedOrigins } = resolveAuthUrls(env);
    expect(baseUrl).toBe("https://kai-ads-git-feature-branch-team.vercel.app");
    expect(trustedOrigins).toContain("https://kai-ads-git-feature-branch-team.vercel.app");
    expect(trustedOrigins).toContain("https://kai-ads-abc123-team.vercel.app");
  });

  it("falls back to the per-deployment VERCEL_URL when no branch URL is available", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "kai-ads-abc123-team.vercel.app",
    };
    const { baseUrl, trustedOrigins } = resolveAuthUrls(env);
    expect(baseUrl).toBe("https://kai-ads-abc123-team.vercel.app");
    expect(trustedOrigins).toContain("https://kai-ads-abc123-team.vercel.app");
  });

  it("every distinct preview deployment's own VERCEL_URL is independently trusted (the original bug)", () => {
    const previewA = resolveAuthUrls({
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "kai-ads-deployment-a.vercel.app",
    });
    const previewB = resolveAuthUrls({
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "kai-ads-deployment-b.vercel.app",
    });
    expect(previewA.trustedOrigins).toContain("https://kai-ads-deployment-a.vercel.app");
    expect(previewB.trustedOrigins).toContain("https://kai-ads-deployment-b.vercel.app");
    // Neither deployment's trusted origins depend on a shared static pin.
    expect(previewA.baseUrl).not.toBe(previewB.baseUrl);
  });
});

describe("resolveAuthUrls — Production domain", () => {
  it("uses VERCEL_PROJECT_PRODUCTION_URL as baseUrl when no explicit override is set", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_URL: "kai-ads.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "ads.kai.example.com",
    };
    const { baseUrl, trustedOrigins } = resolveAuthUrls(env);
    expect(baseUrl).toBe("https://ads.kai.example.com");
    expect(trustedOrigins).toContain("https://ads.kai.example.com");
  });

  it("an explicit BETTER_AUTH_URL always wins over any Vercel-derived URL", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://custom-domain.example.com",
      VERCEL_PROJECT_PRODUCTION_URL: "kai-ads.vercel.app",
    };
    const { baseUrl, trustedOrigins } = resolveAuthUrls(env);
    expect(baseUrl).toBe("https://custom-domain.example.com");
    expect(trustedOrigins).toContain("https://custom-domain.example.com");
  });

  it("does not trust localhost in a production deployment", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "ads.kai.example.com",
    };
    const { trustedOrigins } = resolveAuthUrls(env);
    expect(trustedOrigins).not.toContain("http://localhost:3000");
  });
});

describe("resolveAuthUrls — resolved URLs are always https on Vercel", () => {
  it("every Vercel-derived origin (preview and production) is https, satisfying the secure-cookie requirement", () => {
    const preview = resolveAuthUrls({
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "kai-ads-abc.vercel.app",
    });
    expect(preview.baseUrl.startsWith("https://")).toBe(true);

    const production = resolveAuthUrls({
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "ads.kai.example.com",
    });
    expect(production.baseUrl.startsWith("https://")).toBe(true);
  });
});
