import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * TENANT NEUTRALITY — KAI Ads is a multi-tenant platform.
 *
 * Every recruitment agency on KAI is a tenant whose identity is DATA,
 * held in the `Agency` record (name, logoUrl, secondaryLogoUrl,
 * isoLogoUrl, brandColours, brandBadges, fullRegistrationNumber,
 * meaRegistrationText, footerStyle) and injected at render time.
 *
 * No tenant's name, logo, palette, contact details, registration
 * details, website or slogan may appear in platform code — not as a
 * value, not as a default, and above all not as a FALLBACK.
 *
 * This is not a style rule. A tenant name used as a fallback renders one
 * agency's identity onto another agency's advertisement, which is a
 * false identity claim on a regulated commercial instrument published
 * under a licence number.
 *
 * Real regression this guards: `advertisement-canvas.tsx` rendered the
 * literal "AL YOUSUF ENTERPRISES LLP" as the Agency Trust line whenever
 * a tenant had set no footer text — i.e. for every other tenant on the
 * platform.
 *
 * Tenant names remain legitimate in `tests/` (fixture data) and in
 * `scripts/` (local preview/verification harnesses). They are forbidden
 * in shipped platform code.
 */

/** Known tenant/agency names that have appeared in this project's data. */
const TENANT_IDENTIFIERS = [
  "yousuf",
  "gheewala",
  "seagull",
  "prerna",
  "descon",
  "soundlines",
  "asiapower",
  "jerry varghese",
];

function shippedSourceFiles(dir = "src"): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...shippedSourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

describe("Tenant neutrality (multi-tenant platform law)", () => {
  it("finds source files to check", () => {
    expect(shippedSourceFiles().length).toBeGreaterThan(50);
  });

  for (const identifier of TENANT_IDENTIFIERS) {
    it(`never hardcodes the tenant identifier "${identifier}" in src/`, () => {
      const offenders: string[] = [];

      for (const file of shippedSourceFiles()) {
        const source = readFileSync(file, "utf8");
        source.split("\n").forEach((line, index) => {
          if (line.toLowerCase().includes(identifier)) {
            offenders.push(`${file}:${index + 1}  ${line.trim()}`);
          }
        });
      }

      expect(
        offenders,
        `Tenant identity leaked into platform code. Agency identity is DATA ` +
          `(the Agency record), never code, and never a fallback:\n${offenders.join("\n")}`,
      ).toEqual([]);
    });
  }

  it("the advertisement canvas never falls back to a literal agency name", () => {
    const source = readFileSync(
      "src/components/advertisement/advertisement-canvas.tsx",
      "utf8",
    );

    // The footer must come from supplied data, or degrade to a neutral
    // statement that the identity comes from the Agency profile — never
    // to some agency's actual name.
    //
    // Generic placeholders ("RECRUITMENT CAMPAIGN") are legitimate and
    // must not trip this; what is forbidden is a string carrying a
    // COMPANY designation, which only a real agency name would have.
    const companyLiteral =
      /"[^"]*\b(LLP|LLC|L\.L\.C|L\.L\.P|PVT|PRIVATE LIMITED|LTD|LIMITED|ENTERPRISES|CONSULTANCY|CONSULTANTS|OVERSEAS|MANPOWER|INTERNATIONAL)\b[^"]*"/i;

    expect(
      source.match(companyLiteral),
      "A company-style literal in the canvas is almost certainly a tenant " +
        "name; agency identity must come from the Agency profile.",
    ).toBeNull();
  });
});
