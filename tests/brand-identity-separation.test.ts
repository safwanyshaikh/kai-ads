import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  BRAND_IDENTITY_OWNER,
  BrandIdentityViolationError,
  brandAsset,
  isBrandAsset,
  ownerOf,
  resolveSlotImage,
  type BrandIdentityRole,
} from "@/lib/brand-identity";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";

/**
 * BRAND IDENTITY SEPARATION.
 *
 * A KAI advertisement carries marks belonging to three different
 * parties, and flattening them is a correctness failure, not a styling
 * one: rendering a hiring company's logo as the advertising agency's
 * identity is a false statement about who is advertising, published
 * under the agency's licence number.
 *
 *   KAI      verification QR and verified badge
 *   TENANT   primary logo, secondary logo, ISO/certification, brand badges
 *   CLIENT   the hiring company's logo, supplied per requirement
 *
 * Before this layer every mark was a bare Buffer and no test could catch
 * a mix-up, because nothing recorded which party a mark belonged to.
 *
 * Tenant-neutral: this file names ROLES and invented agencies only.
 */

async function png(colour: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: colour } })
    .png()
    .toBuffer();
}

const TENANT_ROLES: BrandIdentityRole[] = [
  "TENANT_PRIMARY_LOGO",
  "TENANT_SECONDARY_LOGO",
  "TENANT_CERTIFICATION_LOGO",
  "TENANT_BRAND_BADGE",
];

describe("Every role has exactly one owner", () => {
  it("maps each role to the party that owns it", () => {
    for (const role of TENANT_ROLES) expect(ownerOf(role)).toBe("TENANT");
    expect(ownerOf("CLIENT_LOGO")).toBe("CLIENT");
    expect(ownerOf("KAI_VERIFICATION_QR")).toBe("KAI");
    expect(ownerOf("KAI_VERIFICATION_BADGE")).toBe("KAI");
  });

  it("never gives a role to more than one owner", () => {
    for (const [role, owner] of Object.entries(BRAND_IDENTITY_OWNER)) {
      expect(["KAI", "TENANT", "CLIENT"]).toContain(owner);
      expect(ownerOf(role as BrandIdentityRole)).toBe(owner);
    }
  });

  it("keeps certification distinct from a company logo", () => {
    // An ISO badge is neither the tenant's company mark nor a client's.
    expect(ownerOf("TENANT_CERTIFICATION_LOGO")).toBe("TENANT");
    expect("TENANT_CERTIFICATION_LOGO").not.toBe("TENANT_PRIMARY_LOGO");
    expect("TENANT_CERTIFICATION_LOGO").not.toBe("CLIENT_LOGO");
  });
});

describe("A slot refuses a mark belonging to another party", () => {
  it("rejects a CLIENT logo in the tenant logo slot", async () => {
    const client = brandAsset("CLIENT_LOGO", await png({ r: 255, g: 0, b: 255 }));
    expect(() =>
      resolveSlotImage("tenant logo slot", ["TENANT_PRIMARY_LOGO"], client),
    ).toThrow(BrandIdentityViolationError);
  });

  it("rejects a TENANT logo in the client slot", async () => {
    const tenant = brandAsset("TENANT_PRIMARY_LOGO", await png({ r: 0, g: 0, b: 255 }));
    expect(() => resolveSlotImage("client logo slot", ["CLIENT_LOGO"], tenant)).toThrow(
      BrandIdentityViolationError,
    );
  });

  it("rejects a tenant or client mark in KAI's verification slot", async () => {
    const tenant = brandAsset("TENANT_PRIMARY_LOGO", await png({ r: 0, g: 0, b: 255 }));
    const client = brandAsset("CLIENT_LOGO", await png({ r: 255, g: 0, b: 255 }));
    for (const asset of [tenant, client]) {
      expect(() => resolveSlotImage("QR slot", ["KAI_VERIFICATION_QR"], asset)).toThrow(
        BrandIdentityViolationError,
      );
    }
  });

  it("rejects a certification asset in the primary logo slot", async () => {
    const iso = brandAsset("TENANT_CERTIFICATION_LOGO", await png({ r: 0, g: 200, b: 0 }));
    // Both are tenant-owned, so ownership alone is not the check — the
    // ROLE is. A certification badge is not the agency's company mark.
    expect(ownerOf(iso.role)).toBe("TENANT");
    expect(() => resolveSlotImage("tenant logo slot", ["TENANT_PRIMARY_LOGO"], iso)).toThrow(
      BrandIdentityViolationError,
    );
  });

  it("names both the supplied role and the owner it belongs to", async () => {
    const client = brandAsset("CLIENT_LOGO", await png({ r: 255, g: 0, b: 255 }));
    try {
      resolveSlotImage("tenant logo slot", ["TENANT_PRIMARY_LOGO"], client);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BrandIdentityViolationError);
      const err = e as BrandIdentityViolationError;
      expect(err.code).toBe("BRAND_IDENTITY_VIOLATION");
      expect(err.supplied).toBe("CLIENT_LOGO");
      expect(err.allowed).toContain("TENANT_PRIMARY_LOGO");
      expect(err.message).toMatch(/CLIENT/);
      expect(err.message).toMatch(/TENANT/);
    }
  });

  it("accepts the correct role in each slot", async () => {
    const tenant = brandAsset("TENANT_PRIMARY_LOGO", await png({ r: 0, g: 0, b: 255 }));
    const qr = brandAsset("KAI_VERIFICATION_QR", await png({ r: 0, g: 0, b: 0 }));
    expect(resolveSlotImage("tenant", ["TENANT_PRIMARY_LOGO"], tenant)).toBeInstanceOf(Buffer);
    expect(resolveSlotImage("qr", ["KAI_VERIFICATION_QR"], qr)).toBeInstanceOf(Buffer);
  });

  it("passes an untagged buffer through, and does not pretend to have checked it", async () => {
    const bare = await png({ r: 1, g: 2, b: 3 });
    expect(isBrandAsset(bare)).toBe(false);
    expect(resolveSlotImage("tenant", ["TENANT_PRIMARY_LOGO"], bare)).toBe(bare);
  });
});

describe("The trust footer enforces its slots end to end", () => {
  const base = {
    widthPx: 1080,
    heightPx: 1200,
    agencyName: "Novara HR",
    registrationNumber: "B-0101/DEL/PER/1000+/5-2/9/1121/2011",
  };

  it("refuses to render a client logo as the agency's identity", async () => {
    const canvas = await sharp({
      create: { width: 1080, height: 1200, channels: 3, background: { r: 12, g: 14, b: 22 } },
    })
      .png()
      .toBuffer();

    await expect(
      applyBrandingOverlay({
        ...base,
        imagePng: canvas,
        agencyLogoPng: brandAsset("CLIENT_LOGO", await png({ r: 255, g: 0, b: 255 })),
      }),
    ).rejects.toBeInstanceOf(BrandIdentityViolationError);
  }, 60_000);

  it("renders the tenant's own primary mark in that slot", async () => {
    const canvas = await sharp({
      create: { width: 1080, height: 1200, channels: 3, background: { r: 12, g: 14, b: 22 } },
    })
      .png()
      .toBuffer();

    const out = await applyBrandingOverlay({
      ...base,
      imagePng: canvas,
      agencyLogoPng: brandAsset("TENANT_PRIMARY_LOGO", await png({ r: 0, g: 0, b: 255 })),
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1200);
  }, 60_000);

  it("refuses a tenant mark in the verification QR slot", async () => {
    const canvas = await sharp({
      create: { width: 1080, height: 1200, channels: 3, background: { r: 12, g: 14, b: 22 } },
    })
      .png()
      .toBuffer();

    await expect(
      applyBrandingOverlay({
        ...base,
        imagePng: canvas,
        qrPng: brandAsset("TENANT_PRIMARY_LOGO", await png({ r: 0, g: 0, b: 255 })),
      }),
    ).rejects.toBeInstanceOf(BrandIdentityViolationError);
  }, 60_000);
});

describe("Tenant neutrality of the identity layer", () => {
  it("names roles, never agencies", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/brand-identity.ts", "utf8");
    for (const tenant of ["yousuf", "gheewala", "novara", "meridian", "continental"]) {
      expect(src.toLowerCase()).not.toContain(tenant);
    }
  });
});
