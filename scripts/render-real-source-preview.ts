import { renderFactLayer } from "../src/server/generation/pipeline/fact-layer";
import { campaignFromAdvertisementFacts, assessDtpCapacity } from "../src/server/generation/pipeline/content-intelligence";
import { MANPOWER_VACANT_POSITION_2 } from "../tests/fixtures/manpower-vacant-position-2";
import type { AdvertisementFacts } from "../src/server/generation/pipeline/types";
import fs from "node:fs";

async function main() {
  const facts: AdvertisementFacts = {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas — Maintenance Project",
    country: "Saudi Arabia",
    employer: "Saudi Aramco Maintenance Project",
    positions: MANPOWER_VACANT_POSITION_2.map((p) => ({
      title: p.title,
      count: p.count,
      experience: p.experience ?? undefined,
      qualification: p.qualification ?? undefined,
      certifications: p.certifications,
    })),
    benefits: [
      { label: "Free Food & Accommodation" },
      { label: "Free Air Ticket" },
      { label: "Medical Insurance" },
    ],
    interview: [],
    contact: { phone: "+91 98765 43210", email: "recruitment@example-agency.com" },
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  };

  const campaign = campaignFromAdvertisementFacts(facts);
  console.log("Campaign summary:", campaign.vacancySummary);
  console.log("Capacity check:", assessDtpCapacity(campaign, 1080));
  console.log(
    "Role families:",
    campaign.roleFamilies.map((f) => ({ id: f.id, n: f.positionTitles.length, common: f.commonRequirement.length })),
  );

  const result = await renderFactLayer({ facts, widthPx: 1080, heightPx: 1080 });
  const outPath =
    "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad/real-19-role-render.png";
  fs.writeFileSync(outPath, result.png);
  console.log("Rendered", result.png.length, "bytes, height", result.heightPx, "artwork", result.artworkHeightPx);
  console.log("theme:", result.themeSelection);
  console.log("written to", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
