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

  it("Step 6: does not truncate merged text beyond 20000 characters — chunking, not truncation, handles capacity", () => {
    const rawText = "a".repeat(15000);
    const attachmentText = "b".repeat(15000);
    const merged = buildMergedExtractionText({
      rawText,
      attachmentTexts: [{ fileName: "big.pdf", text: attachmentText }],
    });
    const expected = [rawText, `--- ATTACHMENT: big.pdf ---\n${attachmentText}`].join("\n\n");
    expect(merged).toBe(expected);
    expect(merged.length).toBeGreaterThan(20000);
    expect(merged).toContain(attachmentText);
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
