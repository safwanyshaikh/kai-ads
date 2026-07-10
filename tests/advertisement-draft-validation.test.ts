import { describe, expect, it } from "vitest";
import { createDraftSchema } from "@/lib/validations/advertisement-draft";

describe("createDraftSchema", () => {
  it("accepts PASTE_TEXT with enough text", () => {
    const result = createDraftSchema.safeParse({
      sourceType: "PASTE_TEXT",
      rawText: "Need 10 welders for a UAE construction site, 2 year contract.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects PASTE_TEXT with too little text", () => {
    const result = createDraftSchema.safeParse({ sourceType: "PASTE_TEXT", rawText: "hi" });
    expect(result.success).toBe(false);
  });

  it("rejects PASTE_TEXT with no text at all", () => {
    const result = createDraftSchema.safeParse({ sourceType: "PASTE_TEXT" });
    expect(result.success).toBe(false);
  });

  it("accepts PDF with a sourceFileUrl", () => {
    const result = createDraftSchema.safeParse({
      sourceType: "PDF",
      sourceFileUrl: "https://storage.example.com/file.pdf",
    });
    expect(result.success).toBe(true);
  });

  it("rejects PDF with no sourceFileUrl", () => {
    const result = createDraftSchema.safeParse({ sourceType: "PDF" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown sourceType", () => {
    const result = createDraftSchema.safeParse({
      sourceType: "EMAIL",
      rawText: "some text that is long enough to pass the length check",
    });
    expect(result.success).toBe(false);
  });

  it.each(["PDF", "DOCX", "IMAGE", "WHATSAPP_SCREENSHOT"] as const)(
    "accepts %s with a sourceFileUrl",
    (sourceType) => {
      const result = createDraftSchema.safeParse({
        sourceType,
        sourceFileUrl: "https://storage.example.com/file",
      });
      expect(result.success).toBe(true);
    },
  );
});
