import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db";
import { getEnv, getIntegrationStatus } from "@/lib/env";
import { emailService } from "@/server/services/email.service";
import { assertBusinessEmail } from "@/server/services/email-validation.service";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth");

const env = getEnv();
const integrations = getIntegrationStatus(env);

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
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: prismaAdapter(db, { provider: "postgresql" }),

  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "AGENCY_USER" },
      status: { type: "string", input: false, defaultValue: "PENDING" },
      agencyId: { type: "string", required: false, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day
  },

  socialProviders: {
    ...(integrations.google
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
            // Business email only — personal Gmail accounts are rejected
            // at the callback hook below, matching the Golden Rule.
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

export type Auth = typeof auth;
