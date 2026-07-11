import { detectProhibitedClaims } from "./prohibited-claims.service";

type TrustStatus = "TRUST_READY" | "REVIEW_RECOMMENDED" | "BLOCKED";

interface TrustCheckInput {
  agencyName: string | null | undefined;
  raLicenseId: string | null | undefined;
  qrDecodable: boolean;
  contactPresent: boolean;
  advertisementTexts: (string | null | undefined)[]; // header, footer, badge text, etc.
}

interface TrustCheckResult {
  status: TrustStatus;
  warnings: string[];
}

/**
 * Social Trust Check (Sprint 004). Run before an advertisement can be
 * marked ready. A prohibited claim or an undecodable QR is an automatic
 * BLOCKED — these aren't "recommendations," they're the two things the
 * brief treats as non-negotiable ("BLOCK READY STATUS" for QR; false/
 * misleading claims are listed as a hard trust-check failure, not a
 * warning). Missing-but-not-dangerous data (no contact info) is
 * REVIEW_RECOMMENDED — the recruiter should look at it, but it isn't a
 * deception risk.
 */
export function runTrustCheck(input: TrustCheckInput): TrustCheckResult {
  const warnings: string[] = [];

  const claimCheck = detectProhibitedClaims(input.advertisementTexts);
  if (!claimCheck.clean) {
    return { status: "BLOCKED", warnings: claimCheck.violations };
  }

  if (!input.qrDecodable) {
    return { status: "BLOCKED", warnings: ["Verification QR code could not be decoded."] };
  }

  if (!input.agencyName) {
    warnings.push("Agency identity is missing from the advertisement.");
  }
  if (!input.raLicenseId) {
    warnings.push("RA License ID is missing — the agency may not be verified yet.");
  }
  if (!input.contactPresent) {
    warnings.push("No contact information is present on the advertisement.");
  }

  if (warnings.length > 0) {
    return { status: "REVIEW_RECOMMENDED", warnings };
  }

  return { status: "TRUST_READY", warnings: [] };
}
