import { getEnv, getPersonalEmailDomains } from "@/lib/env";

/**
 * Golden Rule (Functional Spec, Screen 2 Validation):
 * "Reject personal email domains."
 *
 * The blocklist is environment-driven (PERSONAL_EMAIL_DOMAINS) so it can be
 * extended without a code change — no hardcoded values.
 */
export function extractDomain(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[1]) {
    throw new Error("Invalid email address");
  }
  return parts[1];
}

export function isPersonalEmailDomain(email: string): boolean {
  const domain = extractDomain(email);
  return getPersonalEmailDomains(getEnv()).has(domain);
}

export function assertBusinessEmail(email: string): void {
  if (isPersonalEmailDomain(email)) {
    throw new Error(
      "Personal email addresses are not allowed. Please use your official business email.",
    );
  }
}
