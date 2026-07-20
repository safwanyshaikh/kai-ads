import { describe, expect, it } from "vitest";
import { runKaiIntelligenceEngine } from "@/server/ai/kai-intelligence-engine";
import { buildFakeSuccessToolkit, buildFakeUnimplementedToolkit } from "./fakes/fake-ai-toolkit";
import { AiProviderNotImplementedError } from "@/server/ai/types";

describe("runKaiIntelligenceEngine — with a real (fake) provider configured", () => {
  it("extracts a full structured result from pasted text via the composite capability", async () => {
    const outcome = await runKaiIntelligenceEngine({
      sourceType: "PASTE_TEXT",
      rawText: "Need 10 6G welders and 5 pipe fitters for a UAE construction project.",
      toolkit: buildFakeSuccessToolkit(),
    });

    expect(outcome.result.country.value).toBe("United Arab Emirates");
    expect(outcome.result.industry.value).toBe("Construction");
    expect(outcome.result.positions).toHaveLength(2);
    expect(outcome.provider).toBe("fake-success");
    expect(outcome.model).toBe("fake-model");
  });

  it("Multiple Positions: preserves every position from the source, none dropped", async () => {
    const outcome = await runKaiIntelligenceEngine({
      sourceType: "PASTE_TEXT",
      rawText: "requirement text",
      toolkit: buildFakeSuccessToolkit(),
    });
    const titles = outcome.result.positions.map((p) => p.title);
    expect(titles).toEqual(["6G Welder", "Pipe Fitter"]);
  });

  it("Trade Summary Rule: every position carries its own one-sentence summary", async () => {
    const outcome = await runKaiIntelligenceEngine({
      sourceType: "PASTE_TEXT",
      rawText: "requirement text",
      toolkit: buildFakeSuccessToolkit(),
    });
    for (const position of outcome.result.positions) {
      expect(position.tradeSummary.length).toBeGreaterThan(0);
      expect(position.tradeSummary).not.toContain("\n");
    }
  });

  it("Optional fields: employer, interview, and one position's salary are correctly null, not fabricated", async () => {
    const outcome = await runKaiIntelligenceEngine({
      sourceType: "PASTE_TEXT",
      rawText: "requirement text",
      toolkit: buildFakeSuccessToolkit(),
    });
    expect(outcome.result.employer.value).toBeNull();
    expect(outcome.result.interviewDate.value).toBeNull();
    expect(outcome.result.positions[1].salaryAmount.value).toBeNull();
  });

  it("Confidence handling: HIGH/MEDIUM/LOW are all present across the result, not collapsed to one level", async () => {
    const outcome = await runKaiIntelligenceEngine({
      sourceType: "PASTE_TEXT",
      rawText: "requirement text",
      toolkit: buildFakeSuccessToolkit(),
    });
    const confidences = new Set([
      outcome.result.country.confidence,
      outcome.result.positions[0].salaryAmount.confidence,
      outcome.result.positions[1].salaryAmount.confidence,
    ]);
    expect(confidences.has("HIGH")).toBe(true);
    expect(confidences.has("MEDIUM")).toBe(true);
    expect(confidences.has("LOW")).toBe(true);
  });

  it("Duplicate detection: a flagged possible duplicate is preserved through the pipeline", async () => {
    const outcome = await runKaiIntelligenceEngine({
      sourceType: "PASTE_TEXT",
      rawText: "requirement text",
      toolkit: buildFakeSuccessToolkit({
        positions: [
          {
            title: "Welder",
            tradeSummary: "Perform welding duties.",
            quantity: { value: 5, confidence: "HIGH" },
            salaryAmount: { value: null, confidence: "LOW" },
            salaryCurrency: { value: null, confidence: "LOW" },
            experience: { value: null, confidence: "LOW" },
            qualification: { value: null, confidence: "LOW" },
            ageLimit: { value: null, confidence: "LOW" },
            salaryTiers: [],
            possibleDuplicateOfIndex: null,
          },
          {
            title: "Welder",
            tradeSummary: "Perform welding duties.",
            quantity: { value: 5, confidence: "HIGH" },
            salaryAmount: { value: null, confidence: "LOW" },
            salaryCurrency: { value: null, confidence: "LOW" },
            experience: { value: null, confidence: "LOW" },
            qualification: { value: null, confidence: "LOW" },
            ageLimit: { value: null, confidence: "LOW" },
            salaryTiers: [],
            possibleDuplicateOfIndex: 0,
          },
        ],
      }),
    });
    expect(outcome.result.positions[1].possibleDuplicateOfIndex).toBe(0);
  });

  it("processes an uploaded PDF end-to-end (document processing -> extraction)", async () => {
    const content = "BT /F1 24 Tf 10 100 Td (Need 5 electricians Qatar) Tj ET";
    const pdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 400 200] /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF`;

    const originalFetch = global.fetch;
    global.fetch = (async () =>
      new Response(new Uint8Array(Buffer.from(pdf)), { status: 200 })) as typeof fetch;

    try {
      const outcome = await runKaiIntelligenceEngine({
        sourceType: "PDF",
        sourceFileUrl: "https://storage.example.com/requirement.pdf",
        toolkit: buildFakeSuccessToolkit(),
      });
      expect(outcome.result.positions.length).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("runKaiIntelligenceEngine — Error Handling: AI not configured / unimplemented", () => {
  it("propagates AiProviderNotImplementedError so the caller can fall back to manual entry", async () => {
    await expect(
      runKaiIntelligenceEngine({
        sourceType: "PASTE_TEXT",
        rawText: "requirement text",
        toolkit: buildFakeUnimplementedToolkit(),
      }),
    ).rejects.toThrow(AiProviderNotImplementedError);
  });

  it("never loses the recruiter's original input on failure — the orchestrator throws, it doesn't mutate/discard rawText", async () => {
    const params = { sourceType: "PASTE_TEXT" as const, rawText: "original recruiter text" };
    try {
      await runKaiIntelligenceEngine({ ...params, toolkit: buildFakeUnimplementedToolkit() });
    } catch {
      // expected
    }
    expect(params.rawText).toBe("original recruiter text");
  });
});

describe("runKaiIntelligenceEngine — input validation", () => {
  it("rejects a PASTE_TEXT source with no rawText", async () => {
    await expect(
      runKaiIntelligenceEngine({ sourceType: "PASTE_TEXT", toolkit: buildFakeSuccessToolkit() }),
    ).rejects.toThrow(/no pasted text/);
  });

  it("rejects a PDF source with no sourceFileUrl", async () => {
    await expect(
      runKaiIntelligenceEngine({ sourceType: "PDF", toolkit: buildFakeSuccessToolkit() }),
    ).rejects.toThrow(/no uploaded file/);
  });
});
