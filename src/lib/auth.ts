import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db";
import { getEnv, getIntegrationStatus, resolveAuthUrls } from "@/lib/env";
import { emailService } from "@/server/services/email.service";
import { assertBusinessEmail } from "@/server/services/email-validation.service";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth");

/**
 * Better Auth server instance.
 *
 * Multi-tenant note: Better Auth only owns identity (User/Session/Account/
 * Verification). Tenant assignment (agencyId, role, status) is domain logic
 * that lives in agency.service.ts / join-request.service.ts and is applied
 * via the `after` hooks below — never inferred inside a UI component.
 *
 * Social providers are registered ONLY when their credentials are present.
 * This is intentional: Better Auth will reject sign-in attempts for a
 * provider that isn't registered, rather than us shipping a fake button
 * that goes nowhere.
 *
 * Built lazily (same pattern as getOpenAiClient() in
 * server/ai/openai/openai-client.ts) rather than at module scope: Next.js's
 * build-time "Collecting page data" step requires() every route module,
 * including ones that only transitively import this file via session.ts.
 * Eagerly calling getEnv()/betterAuth() at module scope ran this
 * validation during the build itself instead of at request time.
 */
function buildAuth() {
  const env = getEnv();
  const integrations = getIntegrationStatus(env);
  // Sprint 006 Bug 001: baseUrl/trustedOrigins are derived per-deployment
  // (local dev, every Vercel Preview, and Production) — see
  // resolveAuthUrls() in env.ts for why a static pair broke Preview.
  const { baseUrl, trustedOrigins } = resolveAuthUrls(env);

  // FIX-008 (HTTPS): refuse to boot in production with a non-HTTPS auth URL.
  // Better Auth issues Secure cookies in production (see advanced.useSecureCookies
  // below); those cookies are silently dropped by browsers over plain HTTP,
  // which would look like "login doesn't work" rather than a clear config error.
  if (env.NODE_ENV === "production" && !baseUrl.startsWith("https://")) {
    throw new Error(
      `Resolved Better Auth base URL must use https:// in production (got "${baseUrl}"). ` +
        "Secure cookies will not be sent over plain HTTP. Set BETTER_AUTH_URL explicitly " +
        "if this deployment has no VERCEL_URL/VERCEL_PROJECT_PRODUCTION_URL available.",
    );
  }

  const instance = betterAuth({
  baseURL: baseUrl,
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(db, { provider: "postgresql" }),

  // FIX-008 / Sprint 006 Bug 001: origin/redirect validation is scoped
  // explicitly to the resolved deployment origins rather than left to
  // library inference — see resolveAuthUrls() in env.ts.
  trustedOrigins,

  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "AGENCY_USER" },
      status: { type: "string", input: false, defaultValue: "PENDING" },
      agencyId: { type: "string", required: false, input: false },
    },
  },

  // FIX-008 (Session Expiry / Refresh Strategy): 7-day session, rolling
  // refresh once per day of activity — a session that's used daily never
  // expires; one that goes untouched for 7 days does. No "remember me"
  // forever-session exists.
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  socialProviders: {
    ...(integrations.google
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
            // FIX-007: `hd: "*"` requires (and Better Auth verifies against
            // the id token's `hd` claim) that the account belongs to SOME
            // Google Workspace hosted domain. Personal @gmail.com accounts
            // have no `hd` claim and are rejected by Better Auth itself
            // before a session is ever created — this is enforced by the
            // library against Google's signed token, not just our
            // databaseHooks personal-email check below. The two are
            // intentionally layered: this catches it at the OAuth
            // callback; the databaseHooks check below is defense in depth
            // for every other signup path (magic link, Microsoft).
            hd: "*",
          },
        }
      : {}),
    ...(integrations.microsoft
      ? {
          microsoft: {
            clientId: env.MICROSOFT_CLIENT_ID!,
            clientSecret: env.MICROSOFT_CLIENT_SECRET!,
            tenantId: env.MICROSOFT_TENANT_ID,
          },
        }
      : {}),
  },

  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 minutes
      sendMagicLink: async ({ email, url }) => {
        assertBusinessEmail(email);
        await emailService.sendMagicLink(email, url);
      },
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          assertBusinessEmail(user.email);
          return { data: user };
        },
      },
    },
  },

  advanced: {
    database: {
      generateId: false, // let Prisma's cuid() default handle IDs
    },
    // FIX-008 (Secure Cookies): explicit rather than relying on the
    // library default, so this is auditable in one place. Better Auth
    // already secures cookies in production by default — this makes that
    // fact a line of code, not an assumption.
    useSecureCookies: env.NODE_ENV === "production",
    // FIX-008 (SameSite): "lax" allows the OAuth redirect flow (Google/
    // Microsoft send the browser back to our domain via a top-level
    // navigation, which Lax permits) while still blocking cross-site
    // POST/fetch requests that would carry the session cookie — the
    // relevant CSRF vector for state-changing requests.
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      httpOnly: true,
    },
    // FIX-008 (CSRF): explicitly NOT disabled. Better Auth's built-in CSRF
    // protection (origin header validation + Fetch Metadata checks) stays
    // on. This line exists so "is CSRF protection on?" is answered by
    // reading the file, not by knowing the library default.
    disableCSRFCheck: false,
  },
  });

  if (!integrations.google) {
    log.warn("Google OAuth not configured — GOOGLE_CLIENT_ID/SECRET missing");
  }
  if (!integrations.microsoft) {
    log.warn("Microsoft OAuth not configured — MICROSOFT_CLIENT_ID/SECRET missing");
  }
  if (!emailService.isConfigured) {
    log.warn("Email provider not configured — Magic Link cannot deliver email");
  }

  return instance;
}

let cachedAuth: ReturnType<typeof buildAuth> | null = null;

/** The only place `betterAuth(...)` is constructed — see buildAuth() above for why this is lazy. */
export function getAuth() {
  if (!cachedAuth) {
    cachedAuth = buildAuth();
  }
  return cachedAuth;
}

export type Auth = ReturnType<typeof buildAuth>;
