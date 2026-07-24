import { describe, expect, it } from "vitest";
import { buildMergedExtractionText } from "@/server/ai/extraction-input-merge";

describe("buildMergedExtractionText", () => {
  it("merges instructions, rawText, and attachments in that fixed order", () => {
    const merged = buildMergedExtractionText({
      instructions: "Highlight the free accommodation.",
      rawText: "Need 10 welders for a 2-year UAE contract.",
      attachmentTexts: [
        { fileName: "requirement.pdf", text: "Salary: 1800 AED. Duty: 8 hours." },
        { fileName: "benefits.docx", text: "Food, transport, medical provided." },
      ],
    });

    expect(merged).toBe(
      [
        "RECRUITER INSTRUCTIONS:\nHighlight the free accommodation.",
        "Need 10 welders for a 2-year UAE contract.",
        "--- ATTACHMENT: requirement.pdf ---\nSalary: 1800 AED. Duty: 8 hours.",
        "--- ATTACHMENT: benefits.docx ---\nFood, transport, medical provided.",
      ].join("\n\n"),
    );
  });

  it("omits the instructions label when there are no instructions", () => {
    const merged = buildMergedExtractionText({
      rawText: "Need 5 electricians for Qatar.",
      attachmentTexts: [{ fileName: "detail.pdf", text: "Salary 2500 QAR." }],
    });
    expect(merged).not.toContain("RECRUITER INSTRUCTIONS:");
    expect(merged).toContain("--- ATTACHMENT: detail.pdf ---");
  });

  it("skips attachments whose extracted text is empty", () => {
    const merged = buildMergedExtractionText({
      rawText: "Need 5 electricians.",
      attachmentTexts: [{ fileName: "blank.pdf", text: "   " }],
    });
    expect(merged).toBe("Need 5 electricians.");
  });

  it("returns an empty string when every source is empty", () => {
    expect(buildMergedExtractionText({})).toBe("");
    expect(buildMergedExtractionText({ instructions: "  ", rawText: "", attachmentTexts: [] })).toBe("");
  });

  it("caps the merged text at 20000 characters", () => {
    const merged = buildMergedExtractionText({
      rawText: "a".repeat(15000),
      attachmentTexts: [{ fileName: "big.pdf", text: "b".repeat(15000) }],
    });
    expect(merged.length).toBe(20000);
  });

  // Sprint 006 Bug 006: merged text ends up echoed back inside
  // extractedData (a jsonb column), so it must be NUL-free like every
  // other text-ingestion boundary.
  it("strips characters Postgres cannot store", () => {
    const merged = buildMergedExtractionText({
      instructions: `Urgent${String.fromCharCode(0x00)} requirement`,
      attachmentTexts: [{ fileName: "scan.pdf", text: `Welders${String.fromCharCode(0x07)} needed` }],
    });
    expect(merged).not.toContain(String.fromCharCode(0x00));
    expect(merged).not.toContain(String.fromCharCode(0x07));
    expect(merged).toContain("Urgent requirement");
    expect(merged).toContain("Welders needed");
  });
});
