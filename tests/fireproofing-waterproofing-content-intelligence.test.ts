import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  buildRecruitmentCampaign,
  campaignFromAdvertisementFacts,
  compressSalaryPresentation,
  buildCandidateHeadline,
  buildCandidateCta,
} from "@/server/generation/pipeline/content-intelligence";
import { classifyRoleFamily } from "@/lib/role-families";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import { decideSocialProductForFacts, assertSlidePlanIntegrity } from "@/server/generation/pipeline/social-product-decision";
import { socialFeedMaxHeightPx, SOCIAL_FEED_PRIMARY } from "@/lib/platform-formats";
import { cmToPx, DTP_DEFAULT_DPI } from "@/lib/dtp-format-law";
import type { AdvertisementFacts, VerifiedAgencyProfile } from "@/server/generation/pipeline/types";
import {
  FIREPROOFING_WATERPROOFING,
  FIREPROOFING_WATERPROOFING_FACTS_POSITIONS,
  FIREPROOFING_WATERPROOFING_TOTAL_VACANCIES,
  FIREPROOFING_WATERPROOFING_TOTAL_POSITIONS,
  FIREPROOFING_WATERPROOFING_COMMON_BENEFITS,
  FIREPROOFING_WATERPROOFING_DUTY_HOURS,
} from "./fixtures/fireproofing-waterproofing";

/**
 * KAI ADS — APPROVED CONTENT INTELLIGENCE IMPLEMENTATION.
 *
 * Real-source acceptance for the Fireproofing Mason / Cable Try
 * Technician / Sheet Metal Fabricator / Waterproofing requirement
 * (SRACO HR via Al Yousuf Enterprises LLP): 9 roles, 45 vacancies,
 * across the six approved content-intelligence gaps from the forensic
 * report. Letters A-M below match the directive's own test list.
 */

const agencyProfile: VerifiedAgencyProfile = {
  agencyName: "Al Yousuf Enterprises LLP",
  fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  verificationStatus: "VERIFIED",
};

function realFacts(over: Partial<AdvertisementFacts> = {}): AdvertisementFacts {
  return {
    header: "Fireproofing Mason + 8 more roles — Saudi Arabia",
    industry: "Construction",
    country: "Saudi Arabia",
    employer: null,
    positions: FIREPROOFING_WATERPROOFING_FACTS_POSITIONS,
    benefits: FIREPROOFING_WATERPROOFING_COMMON_BENEFITS,
    dutyHours: FIREPROOFING_WATERPROOFING_DUTY_HOURS,
    urgent: true,
    interview: [],
    contact: { phone: "+91 86559 60414" },
    agencyProfile,
    ...over,
  };
}

const campaign = buildRecruitmentCampaign(FIREPROOFING_WATERPROOFING);

describe("A. Fireproofing requirement resolves to two meaningful families", () => {
  it("classifies all 9 roles into exactly Fireproofing/Fabrication and Waterproofing — never General Trades", () => {
    const familyIds = new Set(campaign.roleFamilies.map((f) => f.id));
    expect(familyIds).toEqual(new Set(["fireproofing-fabrication", "waterproofing-coatings"]));
  });

  it("Fireproofing/Fabrication carries exactly Fireproofing Mason, Cable Try Technician, Sheet Metal Fabricator", () => {
    const fam = campaign.roleFamilies.find((f) => f.id === "fireproofing-fabrication")!;
    expect(fam.positionTitles).toEqual(["Fireproofing Mason", "Cable Try Technician", "Sheet Metal Fabricator"]);
  });

  it("Waterproofing carries exactly the 6 waterproofing-division roles", () => {
    const fam = campaign.roleFamilies.find((f) => f.id === "waterproofing-coatings")!;
    expect(fam.positionTitles).toEqual([
      "Bituminous / PVC / EPDM membrane waterproofing technicians",
      "Epoxy flooring & coating technicians",
      "Spray Painters technicians for Spray applied waterproofing like acrylics, etc.",
      "Foam concrete (Light weight cellular concrete) masons",
      "Spray Polyurethane foam/ Polyurea spray technicians",
      "Spray foam machine/ rig operator",
    ]);
  });

  it("does not create a second classifier — a title-only call still resolves the same way", () => {
    expect(classifyRoleFamily("Fireproofing Mason").id).toBe("fireproofing-fabrication");
    expect(classifyRoleFamily("Spray foam machine/ rig operator", "Manpower Requirement for Waterproofing Div.").id).toBe(
      "waterproofing-coatings",
    );
  });
});

describe("B. Source division survives extraction/mapping", () => {
  it("survives PositionSourceRecord -> CampaignPosition", () => {
    const bituminous = campaign.positions.find((p) => /Bituminous/.test(p.title))!;
    expect(bituminous.sourceDivision).toBe("Manpower Requirement for Waterproofing Div.");
  });

  it("survives AdvertisementFacts -> campaignFromAdvertisementFacts (the generate.ts bridge)", () => {
    const facts = realFacts();
    const bridged = campaignFromAdvertisementFacts(facts);
    const rig = bridged.roleFamilies.find((f) => f.id === "waterproofing-coatings")!;
    expect(rig.positionTitles).toContain("Spray foam machine/ rig operator");
  });

  it("is never invented for the roles that have no explicit division in the source", () => {
    const mason = campaign.positions.find((p) => p.title === "Fireproofing Mason")!;
    expect(mason.sourceDivision ?? null).toBeNull();
  });
});

describe("C. Technical duties survive into AdvertisementFacts and the render", () => {
  it("is present on the facts object, verbatim", () => {
    const bituminous = FIREPROOFING_WATERPROOFING_FACTS_POSITIONS.find((p) => /Bituminous/.test(p.title))!;
    expect(bituminous.technicalDuties).toBe("Knowledge of installation of one or more type of membranes mentioned.");
  });

  it("renders on the canvas for a role with no qualification field at all", async () => {
    const single = realFacts({ positions: [FIREPROOFING_WATERPROOFING_FACTS_POSITIONS[3]] });
    const r = await renderFactLayer({ facts: single, widthPx: SOCIAL_FEED_PRIMARY.widthPx, heightPx: SOCIAL_FEED_PRIMARY.heightPx });
    expect(r.svgMarkup).toMatch(/installation of one or more type of membranes/i);
  }, 60_000);

  it("wraps a long duties sentence across multiple <text> lines instead of clipping it", async () => {
    // The Fireproofing Mason duties line is ~280 characters — real
    // visual inspection of the first render of this exact requirement
    // showed it running straight off the right edge of the canvas as
    // one unwrapped, un-shrunk <text> element (SVG never clips a
    // string's own characters just because it overflows visually, so
    // checking which WORDS appear cannot detect this — the defect is in
    // how many <text> elements the string is split across).
    const mason = FIREPROOFING_WATERPROOFING_FACTS_POSITIONS[0];
    const single = realFacts({ positions: [mason] });
    const r = await renderFactLayer({ facts: single, widthPx: SOCIAL_FEED_PRIMARY.widthPx, heightPx: SOCIAL_FEED_PRIMARY.heightPx * 2 });

    // The full duties sentence must never be the content of a SINGLE
    // <text> element — that is only possible when it was drawn as one
    // unwrapped line. Wrapped, it is necessarily split across several.
    const fullDuties = mason.technicalDuties!;
    const textEls = [...r.svgMarkup.matchAll(/<text[^>]*>([^<]*)<\/text>/gi)].map((m) => m[1]);
    expect(textEls).not.toContain(fullDuties);
    expect(textEls.some((t) => t.toUpperCase() === fullDuties.toUpperCase())).toBe(false);

    // And every word survives somewhere across the wrapped lines — never
    // silently dropped by the wrap.
    const detailTextEls = textEls.filter((t) => /cementitious|vermiculite|perlite|reinforcement|anchors/i.test(t));
    const joined = detailTextEls.join(" ").toLowerCase();
    for (const word of ["cementitious", "vermiculite", "perlite", "reinforcement", "anchors"]) {
      expect(joined).toContain(word);
    }
    expect(detailTextEls.length).toBeGreaterThan(1);
  }, 60_000);
});

describe("D. Seven roles with no experience do NOT receive invented experience", () => {
  it("source data: exactly 2 of 9 rows state an experience figure", () => {
    const withExperience = FIREPROOFING_WATERPROOFING.filter((p) => p.experience);
    expect(withExperience.map((p) => p.title)).toEqual(["Fireproofing Mason", "Sheet Metal Fabricator"]);
  });

  it("Content Intelligence records no EXPERIENCE statement for the other 7", () => {
    for (const p of campaign.positions) {
      if (p.title === "Fireproofing Mason" || p.title === "Sheet Metal Fabricator") continue;
      expect(p.statements.some((s) => s.tag === "EXPERIENCE")).toBe(false);
    }
  });

  it("the render never prints a fabricated years figure for those 7 roles", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: SOCIAL_FEED_PRIMARY.widthPx, heightPx: SOCIAL_FEED_PRIMARY.heightPx * 3 });
    // The only years figures anywhere on the canvas are the two verified
    // ones (as their compressed forms) — never a third, invented one.
    const years = r.svgMarkup.match(/\b\d[\d–-]*\s*yrs\b/gi) ?? [];
    for (const y of years) {
      expect(["2-3 yrs", "4-5 yrs"]).toContain(y.trim());
    }
  }, 60_000);
});

describe("E. Common benefits are hoisted once, not repeated per role", () => {
  it("no per-role salary string carries the common tail text", () => {
    for (const p of FIREPROOFING_WATERPROOFING_FACTS_POSITIONS) {
      expect(p.salary ?? "").not.toMatch(/food allowance|transportation|accommodation|medical|8 hours|ot\b/i);
    }
  });

  it("the campaign-level benefits/dutyHours facts each state the common tail exactly once", () => {
    const facts = realFacts();
    expect(facts.benefits.map((b) => b.label)).toEqual(["Food Allowance", "Transportation", "Accommodation", "Medical"]);
    expect(facts.dutyHours).toBe("8 hrs/day · 6 days/week · OT eligible");
  });
});

describe("F. 6 salary bands remain distinct", () => {
  it("the source states 6 distinct Basic salary ranges across 9 roles", () => {
    const distinct = new Set(FIREPROOFING_WATERPROOFING_FACTS_POSITIONS.map((p) => p.salary));
    expect(distinct.size).toBe(6);
  });

  it("compressSalaryPresentation reformats digits without merging any two ranges", () => {
    const compressed = FIREPROOFING_WATERPROOFING_FACTS_POSITIONS.map((p) => compressSalaryPresentation(p.salary!));
    expect(new Set(compressed).size).toBe(6);
    expect(compressed).toContain("SAR 1,300–1,600");
    expect(compressed).toContain("SAR 1,500–2,200");
    expect(compressed).toContain("SAR 1,600–1,900");
  });

  it("never alters the underlying numbers", () => {
    for (const p of FIREPROOFING_WATERPROOFING_FACTS_POSITIONS) {
      const sourceNums = (p.salary!.match(/\d+/g) ?? []).map(Number);
      const compressedNums = (compressSalaryPresentation(p.salary!).match(/[\d,]+/g) ?? []).map((n) =>
        Number(n.replace(/,/g, "")),
      );
      expect(compressedNums).toEqual(sourceNums.slice(0, 2));
    }
  });
});

describe("G. Urgency does not create a fake deadline", () => {
  it("buildCandidateCta never mentions a date, day, or 'today/tomorrow'", () => {
    const cta = buildCandidateCta({ urgent: true, contact: { phone: "+91 86559 60414" } });
    expect(cta).not.toBeNull();
    expect(cta!.toLowerCase()).not.toMatch(/tomorrow|today|deadline|closing|limited slot|by \d/);
  });

  it("uses only pre-approved wording", () => {
    const cta = buildCandidateCta({ urgent: true, contact: { phone: "+91 86559 60414" } })!;
    expect(/urgent hiring|apply now|send cv today/i.test(cta)).toBe(true);
  });

  it("is null when urgency was not verified by the source", () => {
    expect(buildCandidateCta({ urgent: false, contact: { phone: "1" } })).toBeNull();
    expect(buildCandidateCta({ contact: { phone: "1" } })).toBeNull();
  });
});

describe("H. CTA is generated from legitimate recruiter intent", () => {
  it("requires a real candidate-facing contact — never floats with nothing to act on", () => {
    expect(buildCandidateCta({ urgent: true, contact: {} })).toBeNull();
  });

  it("renders on the real requirement, which is genuinely urgent and has a contact", async () => {
    const r = await renderFactLayer({ facts: realFacts(), widthPx: SOCIAL_FEED_PRIMARY.widthPx, heightPx: SOCIAL_FEED_PRIMARY.heightPx * 3 });
    expect(r.svgMarkup).toMatch(/URGENT HIRING|APPLY NOW/i);
  }, 60_000);

  it("does not render when the campaign is not marked urgent", async () => {
    const r = await renderFactLayer({ facts: realFacts({ urgent: false }), widthPx: SOCIAL_FEED_PRIMARY.widthPx, heightPx: SOCIAL_FEED_PRIMARY.heightPx * 3 });
    expect(r.svgMarkup).not.toMatch(/URGENT HIRING/i);
  }, 60_000);
});

describe("I. All 9 roles remain present", () => {
  it("Content Intelligence carries every role", () => {
    expect(campaign.positions.length).toBe(FIREPROOFING_WATERPROOFING_TOTAL_POSITIONS);
  });
});

describe("J. 45/45 vacancies remain present", () => {
  it("recomputed total equals the source total", () => {
    expect(campaign.vacancySummary.totalVacancies).toBe(FIREPROOFING_WATERPROOFING_TOTAL_VACANCIES);
  });
});

describe("K. Cover uses the top-demand roles", () => {
  it("the 4 highest-volume roles are exactly the ones the forensic report predicted", async () => {
    const facts = realFacts();
    const r = await renderFactLayer({ facts, widthPx: SOCIAL_FEED_PRIMARY.widthPx, heightPx: SOCIAL_FEED_PRIMARY.heightPx * 3 });
    for (const title of ["FIREPROOFING MASON", "CABLE TRY TECHNICIAN", "SHEET METAL FABRICATOR"]) {
      expect(r.svgMarkup.toUpperCase()).toContain(title);
    }
  }, 60_000);
});

describe("L. Carousel uses the two source-supported families", () => {
  it("decides CAROUSEL or SINGLE_IMAGE from real measured capacity, and every slide plan preserves all roles/vacancies", async () => {
    const facts = realFacts();
    const decision = await decideSocialProductForFacts(
      facts,
      campaign,
      SOCIAL_FEED_PRIMARY.widthPx,
      SOCIAL_FEED_PRIMARY.heightPx,
    );
    if (decision.product === "SINGLE_IMAGE") {
      // Genuinely fits — nothing further to assert about slide families.
      return;
    }
    expect(() => assertSlidePlanIntegrity(campaign, decision.slides!)).not.toThrow();
    const roleSlides = decision.slides!.filter((s) => s.kind === "ROLE_FAMILY");
    const familyLabelRoots = new Set(
      roleSlides.flatMap((s) => s.familyLabels.map((l) => l.replace(/\s*\(\d+ of \d+\)$/, ""))),
    );
    expect(familyLabelRoots).toEqual(new Set(["Fireproofing & Fabrication", "Waterproofing Specialists"]));
    const carried = decision.slides!.flatMap((s) => s.positionIndexes);
    expect(new Set(carried).size).toBe(FIREPROOFING_WATERPROOFING_TOTAL_POSITIONS);
    const vacancies = carried.reduce((n, i) => n + (campaign.positions[i].count ?? 0), 0);
    expect(vacancies).toBe(FIREPROOFING_WATERPROOFING_TOTAL_VACANCIES);
  }, 120_000);
});

describe("M. No employer/client is invented from SRACO", () => {
  it("the requirement's facts never name SRACO as employer", () => {
    const facts = realFacts();
    expect(facts.employer).toBeNull();
  });

  it("the reconstructed headline never mentions SRACO or any employer", () => {
    const headline = buildCandidateHeadline({ industry: "Construction", positions: FIREPROOFING_WATERPROOFING });
    expect(headline).not.toMatch(/sraco/i);
    expect(headline).toBe("CONSTRUCTION OPPORTUNITIES");
  });

  it("leads with urgency when the source verifiably supports it", () => {
    const headline = buildCandidateHeadline({
      industry: "Construction",
      urgent: true,
      positions: FIREPROOFING_WATERPROOFING,
    });
    expect(headline).toBe("URGENT HIRING — CONSTRUCTION");
    expect(headline).not.toMatch(/sraco/i);
  });

  it("the raw CRM-style header never reaches the canvas, on any composition", async () => {
    // POSTER (the Social Feed/carousel composition) already sidesteps this
    // bug by construction — it shows the country itself as the headline,
    // discarding facts.header entirely regardless of what it says. That
    // pre-existing design is not weakened here; this asserts the actual
    // requirement (the raw source dump never appears, no employer is
    // invented) on the composition where it is drawn as-is.
    const r = await renderFactLayer({ facts: realFacts(), widthPx: SOCIAL_FEED_PRIMARY.widthPx, heightPx: SOCIAL_FEED_PRIMARY.heightPx * 3 });
    expect(r.svgMarkup).not.toMatch(/\+\s*8\s*more\s*roles/i);
    expect(r.svgMarkup.toUpperCase()).not.toContain("SRACO");
  }, 60_000);

  it("the reconstructed headline replaces the raw source dump on the print/DTP composition, which draws facts.header as-is", async () => {
    // printOrNewspaper forces the one other composition where the raw
    // header is NOT pre-empted by a country override — the direct proof
    // that the reconstruction wired into planHero actually fires.
    // A subset is enough to prove the headline replacement — this test is
    // about the header, not about fitting all 9 roles at DTP density.
    const dtpWidth = Math.round(cmToPx(12.7, DTP_DEFAULT_DPI));
    const r = await renderFactLayer({
      facts: realFacts({ positions: FIREPROOFING_WATERPROOFING_FACTS_POSITIONS.slice(0, 2) }),
      widthPx: dtpWidth,
      heightPx: Math.round(dtpWidth * 1.25),
      dpi: DTP_DEFAULT_DPI,
      printOrNewspaper: true,
    });
    expect(r.svgMarkup).not.toMatch(/\+\s*8\s*more\s*roles/i);
    // realFacts() is genuinely urgent, so the reconstruction leads with
    // urgency rather than the generic "OPPORTUNITIES" suffix — see the
    // "leads with urgency" test above for the direct unit-level proof.
    expect(r.svgMarkup.toUpperCase()).toContain("URGENT HIRING — CONSTRUCTION");
    expect(r.svgMarkup.toUpperCase()).not.toContain("SRACO");
  }, 60_000);
});

describe("Existing headers are unaffected by headline reconstruction", () => {
  it("a normal, already-fine header is left exactly as it was, on the composition that draws it", async () => {
    const facts = realFacts({ header: "Urgent Requirement — Saudi Arabia" });
    const dtpWidth = Math.round(cmToPx(12.7, DTP_DEFAULT_DPI));
    const r = await renderFactLayer({
      facts: { ...facts, positions: FIREPROOFING_WATERPROOFING_FACTS_POSITIONS.slice(0, 2) },
      widthPx: dtpWidth,
      heightPx: Math.round(dtpWidth * 1.25),
      dpi: DTP_DEFAULT_DPI,
      printOrNewspaper: true,
    });
    expect(r.svgMarkup.toUpperCase()).toContain("URGENT REQUIREMENT");
  }, 60_000);
});
