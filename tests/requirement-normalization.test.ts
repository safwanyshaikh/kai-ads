import { describe, expect, it } from "vitest";
import {
  normalizeDestinationCountry,
  normalizeEmail,
  normalizeExperienceText,
  normalizeHeadcount,
  normalizeInterviewDate,
  normalizePhone,
  normalizeSalaryText,
  normalizeTradeTitle,
} from "@/server/ai/requirement-normalization";

/**
 * Requirement Intelligence — deterministic normalization (Task 002).
 *
 * Two properties are under test throughout, and they matter more than any
 * individual case:
 *
 *   1. DETERMINISM — the same input always yields the same output.
 *   2. NON-INVENTION — a rule may canonicalize what the source said and
 *      nothing else. When it cannot, it hands back the raw text and says
 *      why, rather than guessing.
 *
 * Every rule also has to produce a reason, because a normalized value a
 * recruiter cannot interrogate is a value they will not trust.
 */

describe("determinism — the whole engine's foundation", () => {
  const cases: [string, () => unknown][] = [
    ["country", () => normalizeDestinationCountry("KSA")],
    ["headcount", () => normalizeHeadcount("15 Nos")],
    ["salary", () => normalizeSalaryText("3200", "Saudi Arabia")],
    ["experience", () => normalizeExperienceText("min 5 yrs exp")],
    ["trade title", () => normalizeTradeTitle("SENIOR pipe FITTER")],
    ["phone", () => normalizePhone("+91 98765 43210")],
    ["email", () => normalizeEmail("Jobs@Example.COM")],
    ["interview date", () => normalizeInterviewDate("14th August 2026")],
  ];

  it.each(cases)("%s produces an identical result on repeated runs", (_name, run) => {
    const results = Array.from({ length: 5 }, run);
    for (const result of results) expect(result).toEqual(results[0]);
  });

  it("every rule always supplies a non-empty reason", () => {
    for (const [, run] of cases) {
      expect((run() as { reason: string }).reason.length).toBeGreaterThan(0);
    }
  });
});

describe("normalizeDestinationCountry", () => {
  it.each([
    ["KSA", "Saudi Arabia"],
    ["ksa", "Saudi Arabia"],
    ["Saudi", "Saudi Arabia"],
    ["Riyadh", "Saudi Arabia"],
    ["UAE", "United Arab Emirates"],
    ["Dubai", "United Arab Emirates"],
    ["Abu Dhabi", "United Arab Emirates"],
    ["Doha", "Qatar"],
    ["Muscat", "Oman"],
  ])("canonicalizes %s to %s", (input, expected) => {
    expect(normalizeDestinationCountry(input).value).toBe(expected);
  });

  it("does not match an alias inside an unrelated word", () => {
    // "oman" is a substring of "Romania" — a naive contains() check here
    // would send a Romanian requirement to Oman.
    expect(normalizeDestinationCountry("Romania").value).toBe("Romania");
  });

  it("keeps an unknown destination exactly as written instead of guessing", () => {
    const result = normalizeDestinationCountry("Turkmenistan");
    expect(result.value).toBe("Turkmenistan");
    expect(result.reason).toContain("matches no known destination");
  });

  it("records absence rather than defaulting to a country", () => {
    expect(normalizeDestinationCountry(null).value).toBeNull();
    expect(normalizeDestinationCountry("   ").value).toBeNull();
  });

  it("always preserves what the source said", () => {
    expect(normalizeDestinationCountry("  KSA  ").raw).toBe("KSA");
  });
});

describe("normalizeHeadcount", () => {
  it.each([
    ["15", 15],
    ["15 Nos", 15],
    ["15 nos.", 15],
    ["Qty: 15", 15],
    ["x15", 15],
    ["15 vacancies", 15],
    ["15 positions", 15],
  ])("reads %s as %i", (input, expected) => {
    expect(normalizeHeadcount(input).value).toBe(expected);
  });

  it("accepts a genuine number", () => {
    expect(normalizeHeadcount(20).value).toBe(20);
  });

  it.each(["10-15", "10 – 15", "10 to 15", "10/15"])(
    "refuses the range %s rather than picking an end of it",
    (input) => {
      const result = normalizeHeadcount(input);
      expect(result.value).toBeNull();
      expect(result.reason).toContain("range");
      // The original is still there for the recruiter to resolve.
      expect(result.raw).toBe(input);
    },
  );

  it("refuses text containing two unrelated numbers", () => {
    expect(normalizeHeadcount("15 welders 20 fitters").value).toBeNull();
  });

  it.each([0, -5, 1.5, Number.NaN])("rejects %s as a headcount", (input) => {
    expect(normalizeHeadcount(input).value).toBeNull();
  });

  it("records absence rather than defaulting to 1", () => {
    // Defaulting to 1 would understate demand on a public advertisement.
    expect(normalizeHeadcount(null).value).toBeNull();
    expect(normalizeHeadcount("as required").value).toBeNull();
  });
});

describe("normalizeSalaryText", () => {
  it("labels a bare figure with the destination's currency", () => {
    const result = normalizeSalaryText("3200", "Saudi Arabia");
    expect(result.value).toBe("SAR 3200");
    expect(result.changed).toBe(true);
    expect(result.reason).toContain("The amount itself is unchanged");
  });

  it("never overrides a currency the source already stated", () => {
    expect(normalizeSalaryText("AED 2,500", "Saudi Arabia").value).toBe("AED 2,500");
  });

  it("never guesses a currency for an unknown destination", () => {
    expect(normalizeSalaryText("3200", "Atlantis").value).toBe("3200");
  });

  it("never attaches a currency when no destination is known", () => {
    const result = normalizeSalaryText("3200", null);
    expect(result.value).toBe("3200");
    expect(result.reason).toContain("no destination was known");
  });

  it("never converts between currencies", () => {
    // A salary is a promise. Converting it silently changes the promise.
    const result = normalizeSalaryText("SAR 3,200", "United Arab Emirates");
    expect(result.value).toBe("SAR 3,200");
  });

  it("keeps a tiered pay scale as text rather than reducing it to a number", () => {
    const tiered = "SAR 10,000 for 8-9 years; SAR 11,000 for 9-10 years";
    expect(normalizeSalaryText(tiered, "Saudi Arabia").value).toBe(tiered);
  });

  it("records absence rather than inventing a salary", () => {
    expect(normalizeSalaryText(null, "Saudi Arabia").value).toBeNull();
  });
});

describe("normalizeExperienceText", () => {
  it.each([
    ["min 5 yrs", "minimum 5 years"],
    ["5 Yrs exp", "5 years experience"],
    ["3 year", "3 years"],
  ])("expands %s to %s", (input, expected) => {
    expect(normalizeExperienceText(input).value).toBe(expected);
  });

  it("leaves an already-canonical requirement alone", () => {
    const result = normalizeExperienceText("5 years");
    expect(result.value).toBe("5 years");
    expect(result.changed).toBe(false);
  });

  it("records absence rather than defaulting to no experience required", () => {
    expect(normalizeExperienceText(null).value).toBeNull();
  });
});

describe("normalizeTradeTitle", () => {
  it("normalizes shouting to title case", () => {
    expect(normalizeTradeTitle("SENIOR PIPE FITTER").value).toBe("Senior Pipe Fitter");
  });

  it("preserves acronyms and trade codes", () => {
    expect(normalizeTradeTitle("QC Inspector").value).toBe("QC Inspector");
    expect(normalizeTradeTitle("HVAC Technician").value).toBe("HVAC Technician");
    expect(normalizeTradeTitle("Rigger III").value).toBe("Rigger III");
    expect(normalizeTradeTitle("Welder 3G").value).toBe("Welder 3G");
  });

  it("reports the grouping key so aggregation is explainable", () => {
    expect(normalizeTradeTitle("SENIOR PIPE FITTER").reason).toContain("senior pipe fitter");
  });

  it("keeps a real acronym intact even inside a shouted title", () => {
    // The failure mode this guards: treating every all-caps word as an
    // acronym preserves "SENIOR PIPE FITTER" verbatim, which is the most
    // common way recruiters actually type a title.
    expect(normalizeTradeTitle("CSWIP WELDER").value).toBe("CSWIP Welder");
    expect(normalizeTradeTitle("SENIOR QC INSPECTOR").value).toBe("Senior QC Inspector");
    expect(normalizeTradeTitle("HVAC TECHNICIAN GRADE II").value).toBe("HVAC Technician Grade II");
  });

  it("groups casing variants under one key", () => {
    const a = normalizeTradeTitle("welder");
    const b = normalizeTradeTitle("WELDER");
    expect(a.value).toBe(b.value);
  });
});

describe("normalizePhone", () => {
  it("strips punctuation without changing any digit", () => {
    const result = normalizePhone("+91 98765-43210");
    expect(result.value).toBe("+919876543210");
    expect(result.reason).toContain("No country code was added");
  });

  it("never adds a country code that was not in the source", () => {
    // A wrong dialling code sends candidates to a stranger.
    expect(normalizePhone("9876543210").value).toBe("9876543210");
  });

  it("keeps something too short to be a number verbatim rather than repairing it", () => {
    expect(normalizePhone("12345").value).toBe("12345");
  });

  it("records absence rather than inventing a contact number", () => {
    expect(normalizePhone(null).value).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases a well-formed address", () => {
    expect(normalizeEmail("Jobs@Example.COM").value).toBe("jobs@example.com");
  });

  it("keeps a malformed address verbatim rather than correcting it", () => {
    expect(normalizeEmail("jobs at example.com").value).toBe("jobs at example.com");
  });
});

describe("normalizeInterviewDate", () => {
  it("canonicalizes an unambiguous named-month date", () => {
    expect(normalizeInterviewDate("14th August 2026").value).toBe("2026-08-14");
    expect(normalizeInterviewDate("3 Sept 2026").value).toBe("2026-09-03");
  });

  it("refuses an all-numeric date because day-month order is unknowable", () => {
    // 05/06/2026 is 5 June in India and 6 May in the US. A candidate who
    // travels on the wrong day loses a day's wage and the job.
    const result = normalizeInterviewDate("05/06/2026");
    expect(result.value).toBe("05/06/2026");
    expect(result.reason).toContain("day-month order cannot be determined");
  });

  it("does not infer a missing year", () => {
    const result = normalizeInterviewDate("14th August");
    expect(result.value).toBe("--08-14");
    expect(result.reason).toContain("without inferring a year");
  });

  it("keeps free-form scheduling text exactly as written", () => {
    const result = normalizeInterviewDate("next week, will confirm");
    expect(result.value).toBe("next week, will confirm");
  });

  it("records absence rather than scheduling an interview", () => {
    expect(normalizeInterviewDate(null).value).toBeNull();
  });
});
