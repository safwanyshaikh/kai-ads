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

  // Sprint 006 Bug 006: a rich-text email paste (Outlook/Word -> browser
  // textarea) carried a literal NUL byte into rawText, which crashed the
  // very first database write with Postgres error 22P05 ("unsupported
  // Unicode escape sequence"). rawText is now sanitized at this exact
  // validation boundary.
  it("strips a NUL byte from pasted text so it never reaches the database", () => {
    const withNul = `Dear All,${String.fromCharCode(0x00)}\n\nGreetings from Mohamed Alarji Contracting Company!`;
    const result = createDraftSchema.safeParse({ sourceType: "PASTE_TEXT", rawText: withNul });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rawText).not.toContain(String.fromCharCode(0x00));
      expect(result.data.rawText).toContain("Mohamed Alarji Contracting Company");
    }
  });

  // ChatGPT-style composer (Supreme Constitution Principle 12): one
  // submit can mix typed text with several attachments. The draft's
  // sourceType mirrors the FIRST attachment — no "MIXED" enum value.
  describe("composer attachments", () => {
    const pdfAttachment = {
      url: "https://storage.example.com/requirement.pdf",
      sourceType: "PDF" as const,
      fileName: "requirement.pdf",
      mimeType: "application/pdf",
    };
    const imageAttachment = {
      url: "https://storage.example.com/screenshot.png",
      sourceType: "IMAGE" as const,
      fileName: "screenshot.png",
      mimeType: "image/png",
    };

    it("accepts mixed attachments alongside typed instructions", () => {
      const result = createDraftSchema.safeParse({
        sourceType: "PDF",
        instructions: "Use the salary from the PDF, the interview date is in the screenshot.",
        attachments: [pdfAttachment, imageAttachment],
      });
      expect(result.success).toBe(true);
    });

    it("accepts attachments with no text at all", () => {
      const result = createDraftSchema.safeParse({
        sourceType: "IMAGE",
        attachments: [imageAttachment],
      });
      expect(result.success).toBe(true);
    });

    it("accepts instructions-only with no rawText or attachments", () => {
      const result = createDraftSchema.safeParse({
        sourceType: "PASTE_TEXT",
        instructions: "Need 5 electricians for Qatar, salary 2500 QAR.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a sourceType that does not match the first attachment", () => {
      const result = createDraftSchema.safeParse({
        sourceType: "IMAGE",
        attachments: [pdfAttachment, imageAttachment],
      });
      expect(result.success).toBe(false);
    });

    it("rejects more than 10 attachments", () => {
      const result = createDraftSchema.safeParse({
        sourceType: "PDF",
        attachments: Array.from({ length: 11 }, (_, i) => ({
          ...pdfAttachment,
          fileName: `file-${i}.pdf`,
        })),
      });
      expect(result.success).toBe(false);
    });

    it("rejects PASTE_TEXT as an attachment sourceType", () => {
      const result = createDraftSchema.safeParse({
        sourceType: "PASTE_TEXT",
        attachments: [{ ...pdfAttachment, sourceType: "PASTE_TEXT" }],
      });
      expect(result.success).toBe(false);
    });

    // Sprint 006 Bug 006 applies to instructions too — same textarea,
    // same rich-text paste, same Postgres NUL-byte hard rejection.
    it("strips a NUL byte from instructions so it never reaches the database", () => {
      const withNul = `Highlight the food allowance${String.fromCharCode(0x00)} please`;
      const result = createDraftSchema.safeParse({
        sourceType: "PASTE_TEXT",
        instructions: withNul,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instructions).not.toContain(String.fromCharCode(0x00));
        expect(result.data.instructions).toContain("Highlight the food allowance");
      }
    });
  });
});
