import { renderFactLayer } from "../src/server/generation/pipeline/fact-layer";
import { socialFeedMaxHeightPx } from "../src/lib/platform-formats";
import { MANPOWER_VACANT_POSITION_2 } from "../tests/fixtures/manpower-vacant-position-2";
import type { AdvertisementFacts } from "../src/server/generation/pipeline/types";

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
    benefits: [],
    interview: [],
    contact: {},
    agencyName: "Al-Yousuf Enterprises L.L.P.",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  };

  const ceiling = socialFeedMaxHeightPx("SOCIAL_FEED", 1080);
  console.log("Social Feed ceiling:", ceiling);

  try {
    const r = await renderFactLayer({
      facts,
      widthPx: 1080,
      heightPx: 1350,
      socialFeedMaxHeightPx: ceiling,
    });
    console.log("Rendered (unexpected for this dense dataset):", r.heightPx);
  } catch (e) {
    console.log("Correctly failed closed:", (e as Error).constructor.name, "reason:", (e as { reason?: string }).reason);
    console.log((e as Error).message);
  }

  // Same dense dataset unconstrained — proves the height WOULD have
  // grown well past the ceiling if the law didn't stop it.
  const unconstrained = await renderFactLayer({ facts, widthPx: 1080, heightPx: 1350 });
  console.log("Same dataset, unconstrained (no cap):", unconstrained.heightPx, "px — this is what the cap prevented");

  const smallFacts: AdvertisementFacts = { ...facts, positions: facts.positions.slice(0, 6) };
  const r2 = await renderFactLayer({
    facts: smallFacts,
    widthPx: 1080,
    heightPx: 1350,
    socialFeedMaxHeightPx: ceiling,
  });
  console.log("Small requirement rendered within cap:", r2.heightPx, "<=", ceiling, "?", r2.heightPx <= (ceiling ?? Infinity));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
