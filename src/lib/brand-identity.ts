/**
 * BRAND IDENTITY ROLES — who owns an identity, why it exists, and where
 * it is allowed to appear.
 *
 * A KAI advertisement carries marks belonging to three different parties,
 * and they are NOT interchangeable:
 *
 *   KAI      the product. Owns verification: the QR and the verified
 *            badge. Never a tenant's branding, never a client's.
 *
 *   TENANT   the recruitment agency publishing the advertisement. Its
 *            Agency Profile is the source of truth for its primary logo,
 *            secondary logo, certification (ISO) asset and permanent
 *            brand badges. These are permanent, reusable tenant assets.
 *
 *   CLIENT   the hiring company the vacancies are for. A different legal
 *            entity from the tenant. Its logo is per-requirement and
 *            optional, and it must never occupy a tenant slot — doing so
 *            would publish one company's identity as another's, under
 *            the tenant's licence number.
 *
 * Why this is a type and not a convention: before this module, every
 * mark in the pipeline was a bare `Buffer`. Nothing at the type level or
 * at runtime distinguished "the agency's logo" from "the hiring
 * company's logo" — the tenant logo slot would render whatever buffer it
 * was handed, and a caller that mixed them up produced a false identity
 * claim that no test could catch. A logo is not simply a logo; it has a
 * role, and the role travels with it.
 *
 * Tenant-neutral by construction: this module names ROLES, never
 * agencies. No tenant identity may ever appear here.
 */

export type BrandIdentityOwner = "KAI" | "TENANT" | "CLIENT";

export type BrandIdentityRole =
  /** The agency's primary logo — the trust footer's identity mark. */
  | "TENANT_PRIMARY_LOGO"
  /** An additional permanent agency mark. */
  | "TENANT_SECONDARY_LOGO"
  /** ISO / certification artwork. A certification is not a company logo. */
  | "TENANT_CERTIFICATION_LOGO"
  /** Approved permanent textual claims ("Since 1984", "ISO 9001:2015"). */
  | "TENANT_BRAND_BADGE"
  /** The hiring company's logo, supplied per requirement. */
  | "CLIENT_LOGO"
  /** KAI-generated verification QR, from the verified Agency Profile. */
  | "KAI_VERIFICATION_QR"
  /** KAI-issued verified-agency badge. */
  | "KAI_VERIFICATION_BADGE";

export const BRAND_IDENTITY_OWNER: Readonly<Record<BrandIdentityRole, BrandIdentityOwner>> = {
  TENANT_PRIMARY_LOGO: "TENANT",
  TENANT_SECONDARY_LOGO: "TENANT",
  TENANT_CERTIFICATION_LOGO: "TENANT",
  TENANT_BRAND_BADGE: "TENANT",
  CLIENT_LOGO: "CLIENT",
  KAI_VERIFICATION_QR: "KAI",
  KAI_VERIFICATION_BADGE: "KAI",
} as const;

export function ownerOf(role: BrandIdentityRole): BrandIdentityOwner {
  return BRAND_IDENTITY_OWNER[role];
}

/**
 * A mark with its identity role attached.
 *
 * The role is not metadata — it is what makes the asset placeable. A
 * renderer asks for a role, not for "a logo".
 */
export interface BrandAsset<R extends BrandIdentityRole = BrandIdentityRole> {
  role: R;
  png: Buffer;
  /**
   * Optional provenance for audit surfaces — e.g. the Agency Profile
   * field or the requirement the client logo arrived on. Never rendered.
   */
  source?: string;
}

export function brandAsset<R extends BrandIdentityRole>(
  role: R,
  png: Buffer,
  source?: string,
): BrandAsset<R> {
  return { role, png, source };
}

export function isBrandAsset(value: unknown): value is BrandAsset {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    "png" in value &&
    typeof (value as BrandAsset).role === "string" &&
    (value as BrandAsset).role in BRAND_IDENTITY_OWNER
  );
}

/**
 * Raised when a mark is placed in a slot that belongs to a different
 * party. This is a correctness failure, not a layout one: publishing a
 * client's logo as the agency's identity — or the reverse — is a false
 * statement about who is advertising, made under a licence number.
 */
export class BrandIdentityViolationError extends Error {
  readonly code = "BRAND_IDENTITY_VIOLATION";
  readonly slot: string;
  readonly supplied: BrandIdentityRole;
  readonly allowed: readonly BrandIdentityRole[];

  constructor(slot: string, supplied: BrandIdentityRole, allowed: readonly BrandIdentityRole[]) {
    super(
      `${slot} accepts ${allowed.join(" or ")} (owner: ${allowed
        .map(ownerOf)
        .join("/")}), but was given ${supplied} (owner: ${ownerOf(supplied)}). ` +
        `Brand identities are not interchangeable — a ${ownerOf(supplied)} mark rendered in a ` +
        `${allowed.map(ownerOf)[0]} slot publishes the wrong party's identity.`,
    );
    this.name = "BrandIdentityViolationError";
    this.slot = slot;
    this.supplied = supplied;
    this.allowed = allowed;
  }
}

/**
 * Resolves a slot's image, enforcing that the asset placed in it carries
 * a permitted role.
 *
 * A bare Buffer is accepted for source compatibility with callers that
 * predate this module, and is treated as already-correct for the slot —
 * an untagged mark cannot be checked, so the guard cannot claim it is
 * safe; tagging is what buys the guarantee.
 */
export function resolveSlotImage(
  slot: string,
  allowed: readonly BrandIdentityRole[],
  value: Buffer | BrandAsset | null | undefined,
): Buffer | null {
  if (!value) return null;
  if (isBrandAsset(value)) {
    if (!allowed.includes(value.role)) {
      throw new BrandIdentityViolationError(slot, value.role, allowed);
    }
    return value.png;
  }
  return value as Buffer;
}
