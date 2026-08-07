import "server-only";
import { db } from "@/lib/db";

/**
 * Task 006.5 — the FAT surface needs an Agency row to create drafts and
 * advertisements against (every Task 002-006 write path is agencyId-scoped),
 * but the Founder's own account has no agencyId (see guard.ts). Rather than
 * relaxing that requirement anywhere in the real pipeline, FAT runs always
 * write against this single reserved sandbox agency instead — found or
 * created once, then reused. It is APPROVED so nothing downstream (quota
 * lookup, generation) treats it as a pending tenant, and it is excluded
 * from every founder-facing agency list by convention (registrationNumber
 * prefix), not by a code change to those list queries.
 */
const SANDBOX_REGISTRATION_NUMBER = "KAI-INTERNAL-FAT-SANDBOX";

// 1x1 transparent PNG — logoUrl is required by the Agency schema and is
// read (fetched) only if a founder opts into the full image-generation
// stage; a real agency's logo is never used or substituted here.
const PLACEHOLDER_LOGO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export async function getOrCreateFatSandboxAgency() {
  const existing = await db.agency.findUnique({
    where: { registrationNumber: SANDBOX_REGISTRATION_NUMBER },
  });
  if (existing) return existing;

  return db.agency.create({
    data: {
      name: "KAI Internal — Founder Validation Sandbox",
      registrationNumber: SANDBOX_REGISTRATION_NUMBER,
      website: "https://internal.invalid/fat-sandbox",
      officialEmail: "fat-sandbox@internal.invalid",
      logoUrl: PLACEHOLDER_LOGO_DATA_URL,
      status: "APPROVED",
      officeAddress: "KAI Internal — not a real registered office",
    },
  });
}
