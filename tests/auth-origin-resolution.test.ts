import { describe, expect, it } from "vitest";
import { resolveAuthHostConfig, type Env } from "@/lib/env";

/**
 * Sprint 006 Bug 001 + Bug 002: Better Auth's baseURL/trustedOrigins used
 * to be derived from static env vars (APP_URL/BETTER_AUTH_URL). Every
 * Vercel Preview deployment gets its own unique domain, so only whichever
 * single URL happened to be pinned in Vercel project settings ever passed
 * validation — every other Preview deployment failed with "Invalid
 * origin", and a stale placeholder value ("https://api.example.com") left
 * in Vercel project settings silently became the URL used for every
 * magic link and Google OAuth callback on every environment.
 *
 * The fix hands Better Auth a dynamic `baseURL: { allowedHosts, fallback }`
 * config (see src/lib/auth.ts) so the base URL — and, from it, every
 * trusted origin — is derived from the ACTUAL REQUEST being served, every
 * time, validated against this allowlist. These tests verify the
 * allowlist itself is correct for every deployment context.
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

describe("resolveAuthHostConfig — localhost (local dev)", () => {
  it("allows localhost:3000 and never depends on any manually-set URL", () => {
    const { allowedHosts, fallback } = resolveAuthHostConfig(BASE_ENV);
    expect(allowedHosts).toContain("localhost:3000");
    expect(fallback).toBe("http://localhost:3000");
  });
});

describe("resolveAuthHostConfig — Vercel Preview deployments", () => {
  it("allows every Preview deployment's own VERCEL_URL and the stable VERCEL_BRANCH_URL", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "kai-ads-abc123-team.vercel.app",
      VERCEL_BRANCH_URL: "kai-ads-git-feature-branch-team.vercel.app",
    };
    const { allowedHosts } = resolveAuthHostConfig(env);
    expect(allowedHosts).toContain("kai-ads-abc123-team.vercel.app");
    expect(allowedHosts).toContain("kai-ads-git-feature-branch-team.vercel.app");
  });

  it("never depends on a manually entered URL for Preview — BETTER_AUTH_URL is ignored even if set", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "kai-ads-abc123-team.vercel.app",
      BETTER_AUTH_URL: "https://api.example.com", // the exact incident value
    };
    const { allowedHosts } = resolveAuthHostConfig(env);
    expect(allowedHosts).not.toContain("api.example.com");
  });

  it("carries an unscoped *.vercel.app wildcard so every Preview deployment matches regardless of this project's actual Vercel naming (Bug 003)", () => {
    const { allowedHosts } = resolveAuthHostConfig({
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    });
    expect(allowedHosts).toContain("*.vercel.app");
  });

  it("matches a Vercel host with ANY project/team naming — not just an assumed prefix (Bug 003 regression)", () => {
    const { allowedHosts } = resolveAuthHostConfig({
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    });
    const wildcard = allowedHosts.find((h) => h.includes("*"))!;
    const pattern = new RegExp(`^${wildcard.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`);
    expect(pattern.test("completely-different-project-name-team.vercel.app")).toBe(true);
  });

  it("every distinct preview deployment's own host is independently allowed (the original Bug 001)", () => {
    const previewA = resolveAuthHostConfig({
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "kai-ads-deployment-a.vercel.app",
    });
    const previewB = resolveAuthHostConfig({
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "kai-ads-deployment-b.vercel.app",
    });
    expect(previewA.allowedHosts).toContain("kai-ads-deployment-a.vercel.app");
    expect(previewB.allowedHosts).toContain("kai-ads-deployment-b.vercel.app");
  });
});

describe("resolveAuthHostConfig — Production domain", () => {
  it("allows VERCEL_PROJECT_PRODUCTION_URL", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "ads.kai.example.com",
    };
    const { allowedHosts, fallback } = resolveAuthHostConfig(env);
    expect(allowedHosts).toContain("ads.kai.example.com");
    expect(fallback).toBe("https://ads.kai.example.com");
  });

  it("an explicit BETTER_AUTH_URL is honored as an ADDITIONAL allowed host in Production only (custom-domain escape hatch)", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://custom-domain.example.com",
      VERCEL_PROJECT_PRODUCTION_URL: "kai-ads.vercel.app",
    };
    const { allowedHosts } = resolveAuthHostConfig(env);
    expect(allowedHosts).toContain("custom-domain.example.com");
    expect(allowedHosts).toContain("kai-ads.vercel.app");
  });

  it("a stale/placeholder BETTER_AUTH_URL only ever becomes ONE MORE unreachable allowlist entry, never the served URL", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://api.example.com",
      VERCEL_PROJECT_PRODUCTION_URL: "ads.kai.example.com",
    };
    const { allowedHosts, fallback } = resolveAuthHostConfig(env);
    // The placeholder is present in the allowlist (harmless — no real
    // request will ever arrive with this Host), but the fallback and the
    // real production host both correctly point at the genuine domain.
    expect(allowedHosts).toContain("api.example.com");
    expect(allowedHosts).toContain("ads.kai.example.com");
    expect(fallback).toBe("https://ads.kai.example.com");
  });

  it("does not allow localhost in a production deployment", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "ads.kai.example.com",
    };
    const { allowedHosts } = resolveAuthHostConfig(env);
    expect(allowedHosts).not.toContain("localhost:3000");
  });

  it("does not leak APP_URL's dev-only localhost default into the production allowlist", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "ads.kai.example.com",
      // APP_URL left at its schema default ("http://localhost:3000") —
      // exactly what a real Vercel deployment looks like if nobody set it.
    };
    const { allowedHosts } = resolveAuthHostConfig(env);
    expect(allowedHosts).not.toContain("localhost:3000");
  });
});

describe("resolveAuthHostConfig — fallback is always well-formed https on Vercel", () => {
  it("prefers Vercel-derived values for fallback over any manually-set env var", () => {
    const env: Env = {
      ...BASE_ENV,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "ads.kai.example.com",
      BETTER_AUTH_URL: "https://api.example.com",
    };
    const { fallback } = resolveAuthHostConfig(env);
    expect(fallback).toBe("https://ads.kai.example.com");
  });
});
