import { describe, expect, it } from "vitest";
import { processDocument, fetchAndProcessSourceFile } from "@/server/ai/document-processing.service";
import { UnsupportedDocumentError } from "@/server/ai/openai/errors";

/** A minimal, hand-built, valid single-page PDF containing the text "Need 10 Welders UAE". */
function buildMinimalPdf(text: string): Buffer {
  const content = `BT /F1 24 Tf 10 100 Td (${text}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 400 200] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${content.length} >>
stream
${content}
endstream
endobj
xref
0 6
0000000000 65535 f 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;
  return Buffer.from(pdf);
}

/** A minimal valid 1x1 PNG (magic bytes + IHDR/IDAT/IEND), for MIME-type/passthrough testing. */
const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * A real, structurally valid, unencrypted single-page PDF with a blank
 * content stream (no text at all) — built with pikepdf. Stands in for a
 * scanned/image-only recruitment PDF: no text layer, but not corrupt.
 * Founder FAT bug (2026-08-03): this used to be rejected as EXTRACTION_FAILED
 * with a generic message instead of being routed to vision/OCR.
 */
const BLANK_TEXTLESS_PDF_BASE64 =
  "JVBERi0xLjMKJb/3ov4KMSAwIG9iago8PCAvUGFnZXMgMiAwIFIgL1R5cGUgL0NhdGFsb2cgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcyA+PgplbmRvYmoKMyAwIG9iago8PCAvQ29udGVudHMgNCAwIFIgL01lZGlhQm94IFsgMCAwIDQwMCAyMDAgXSAvUGFyZW50IDIgMCBSIC9SZXNvdXJjZXMgPDwgPj4gL1R5cGUgL1BhZ2UgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAwIC9GaWx0ZXIgL0ZsYXRlRGVjb2RlID4+CnN0cmVhbQoKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2NCAwMDAwMCBuIAowMDAwMDAwMTIzIDAwMDAwIG4gCjAwMDAwMDAyMjkgMDAwMDAgbiAKdHJhaWxlciA8PCAvUm9vdCAxIDAgUiAvU2l6ZSA1IC9JRCBbPDg1ZTFkMWNlZmUwMWZiZTIxZTllZmUxYThjOTc1YzNlPjw4NWUxZDFjZWZlMDFmYmUyMWU5ZWZlMWE4Yzk3NWMzZT5dID4+CnN0YXJ0eHJlZgoyOTkKJSVFT0YK";

/**
 * A real, valid PDF encrypted with owner+user passwords — built with
 * pikepdf's AES-256 encryption. Founder FAT bug (2026-08-03): this used to
 * be rejected with the same generic "could not be read" message as a
 * genuinely corrupt file, giving no way to tell the two apart.
 */
const PASSWORD_PROTECTED_PDF_BASE64 =
  "JVBERi0xLjcKJb/3ov4KMSAwIG9iago8PCAvRXh0ZW5zaW9ucyA8PCAvQURCRSA8PCAvQmFzZVZlcnNpb24gLzEuNyAvRXh0ZW5zaW9uTGV2ZWwgOCA+PiA+PiAvUGFnZXMgMiAwIFIgL1R5cGUgL0NhdGFsb2cgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcyA+PgplbmRvYmoKMyAwIG9iago8PCAvQ29udGVudHMgNCAwIFIgL01lZGlhQm94IFsgMCAwIDQwMCAyMDAgXSAvUGFyZW50IDIgMCBSIC9SZXNvdXJjZXMgPDwgPj4gL1R5cGUgL1BhZ2UgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAzMiAvRmlsdGVyIC9GbGF0ZURlY29kZSA+PgpzdHJlYW0K6/IkIYj7dckcmHc6pRR+gC4rcFkPOF4IsncfrGGNMhMKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9DRiA8PCAvU3RkQ0YgPDwgL0F1dGhFdmVudCAvRG9jT3BlbiAvQ0ZNIC9BRVNWMyAvTGVuZ3RoIDMyID4+ID4+IC9GaWx0ZXIgL1N0YW5kYXJkIC9MZW5ndGggMjU2IC9PIDxkYWM5NzY5MDhhM2QxOGUxM2VjY2NiMzVjZTA2MzkyODM1ZDJiMTgzMmZiYTEzOTIzMjFjOTg3YjgxYjlkMGM0ZGVkZThmNmNiNDJlNDEzMDA0NDZhNjM2ZDQ2ZDYzYmY+IC9PRSA8NzI2ZWI4YTE3MmRmOWMzMjdlM2JlYTExZGU4NjFmOGVjOTg1ZjNkNjI4NzY4Y2FjYjZlOTFmODZkZTE3ZDMyZT4gL1AgLTEwMjggL1Blcm1zIDw2ZDVlNzQxMzg5N2Y0OWViYWI0MzgxNDE3MmFjYTFmNj4gL1IgNiAvU3RtRiAvU3RkQ0YgL1N0ckYgL1N0ZENGIC9VIDw0M2M5MTNhMjk4ZTE5YmVlZThhMzJiZjRhMmYzZjNiNTRjYjdlYzc3M2M3NTA3NDcxZDNhYzU3NzEzZGM0NTgyMjA5MTIyMWQ5N2ZjMGYxYjE2NTFmYzZmMzI3Mjg5N2Q+IC9VRSA8ZTUzNTA2ZDllNDQzMGY5ZTZiOGMxMmNjNDczNmZhYTFiNWU0ODVmZmJjODRiNGYyZjRhZDk1ZGRmNGVmNDBiMj4gL1YgNSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxMzAgMDAwMDAgbiAKMDAwMDAwMDE4OSAwMDAwMCBuIAowMDAwMDAwMjk1IDAwMDAwIG4gCjAwMDAwMDAzOTggMDAwMDAgbiAKdHJhaWxlciA8PCAvUm9vdCAxIDAgUiAvU2l6ZSA2IC9JRCBbPGNiN2E3NmY3MmYxZTYxMWZhZWEwOGRlMThlMzhjM2M1PjxjYjdhNzZmNzJmMWU2MTFmYWVhMDhkZTE4ZTM4YzNjNT5dIC9FbmNyeXB0IDUgMCBSID4+CnN0YXJ0eHJlZgo5NDgKJSVFT0YK";

describe("processDocument — Input Processing / File Validation", () => {
  it("rejects an empty file", async () => {
    await expect(
      processDocument({ data: Buffer.alloc(0), mimeType: "application/pdf", fileName: "empty.pdf" }),
    ).rejects.toThrow(UnsupportedDocumentError);
  });

  it("rejects a file over the size limit", async () => {
    const oversized = Buffer.alloc(16 * 1024 * 1024);
    await expect(
      processDocument({ data: oversized, mimeType: "application/pdf", fileName: "huge.pdf" }),
    ).rejects.toThrow(/15MB/);
  });

  it("rejects an unsupported MIME type", async () => {
    await expect(
      processDocument({ data: Buffer.from("hello"), mimeType: "text/plain", fileName: "x.txt" }),
    ).rejects.toThrow(UnsupportedDocumentError);
  });

  it("rejects a corrupt PDF", async () => {
    await expect(
      processDocument({
        data: Buffer.from("this is not a real pdf"),
        mimeType: "application/pdf",
        fileName: "corrupt.pdf",
      }),
    ).rejects.toThrow(UnsupportedDocumentError);
  });

  it("extracts text from a valid PDF", async () => {
    const result = await processDocument({
      data: buildMinimalPdf("Need 10 Welders UAE"),
      mimeType: "application/pdf",
      fileName: "requirement.pdf",
    });
    expect(result.kind).toBe("text");
    if (result.kind === "text") {
      expect(result.text).toContain("Need 10 Welders UAE");
    }
  });

  it("passes an image straight through as base64 for the vision model, unmodified", async () => {
    const data = Buffer.from(MINIMAL_PNG_BASE64, "base64");
    const result = await processDocument({ data, mimeType: "image/png", fileName: "screenshot.png" });
    expect(result.kind).toBe("image");
    if (result.kind === "image") {
      expect(result.mimeType).toBe("image/png");
      expect(result.base64).toBe(data.toString("base64"));
    }
  });

  it("routes a valid but text-less (scanned/image-only) PDF to vision/OCR instead of failing", async () => {
    const result = await processDocument({
      data: Buffer.from(BLANK_TEXTLESS_PDF_BASE64, "base64"),
      mimeType: "application/pdf",
      fileName: "scanned.pdf",
    });
    expect(result.kind).toBe("image");
    if (result.kind === "image") {
      expect(result.mimeType).toBe("application/pdf");
      expect(result.base64.length).toBeGreaterThan(0);
    }
  });

  it("reports the exact reason for a password-protected PDF instead of a generic message", async () => {
    await expect(
      processDocument({
        data: Buffer.from(PASSWORD_PROTECTED_PDF_BASE64, "base64"),
        mimeType: "application/pdf",
        fileName: "protected.pdf",
      }),
    ).rejects.toThrow(/password-protected/i);
  });

  it("reports a specific, non-generic reason for a genuinely corrupt PDF", async () => {
    let caught: unknown;
    try {
      await processDocument({
        data: Buffer.from("this is not a real pdf"),
        mimeType: "application/pdf",
        fileName: "corrupt.pdf",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnsupportedDocumentError);
    expect((caught as Error).message).not.toBe(
      "This PDF could not be read. It may be corrupt, password-protected, or in an unsupported format.",
    );
    // pdf-parse classifies this input as a structurally invalid PDF (as
    // opposed to a password-protected one, or an unclassified parser
    // exception) — the specific reason FAT's bug report asked to surface.
    expect((caught as Error).message).toMatch(/invalid or corrupt/i);
  });

  it("rejects a corrupt DOCX", async () => {
    await expect(
      processDocument({
        data: Buffer.from("not a real docx file"),
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: "corrupt.docx",
      }),
    ).rejects.toThrow(UnsupportedDocumentError);
  });
});

describe("fetchAndProcessSourceFile — SSRF protection", () => {
  it("rejects a URL pointing at localhost", async () => {
    await expect(fetchAndProcessSourceFile("http://localhost:5432/secret", "PDF")).rejects.toThrow(
      UnsupportedDocumentError,
    );
  });

  it("rejects a URL pointing at a cloud metadata / link-local address", async () => {
    await expect(
      fetchAndProcessSourceFile("http://169.254.169.254/latest/meta-data/", "IMAGE"),
    ).rejects.toThrow(UnsupportedDocumentError);
  });

  it("rejects a private network address (RFC1918)", async () => {
    await expect(fetchAndProcessSourceFile("http://192.168.1.1/", "PDF")).rejects.toThrow(
      UnsupportedDocumentError,
    );
    await expect(fetchAndProcessSourceFile("http://10.0.0.5/", "PDF")).rejects.toThrow(
      UnsupportedDocumentError,
    );
  });

  it("rejects a non-http(s) protocol", async () => {
    await expect(fetchAndProcessSourceFile("file:///etc/passwd", "PDF")).rejects.toThrow(
      UnsupportedDocumentError,
    );
  });

  it("rejects a URL whose host doesn't match configured storage, even if it's a public https URL", async () => {
    await expect(
      fetchAndProcessSourceFile("https://not-our-storage.evil.example.com/x.pdf", "PDF"),
    ).rejects.toThrow(UnsupportedDocumentError);
  });

  it("accepts a URL matching the configured storage host (STORAGE_PUBLIC_URL, set in tests/setup.ts)", async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => new Response("not a real pdf", { status: 200 })) as typeof fetch;
    try {
      // Reaches processDocument (and fails there on corrupt content) — proving
      // the SSRF check itself passed for this host, unlike the rejected cases above.
      await expect(
        fetchAndProcessSourceFile("https://storage.example.com/advertisement-sources/x.pdf", "PDF"),
      ).rejects.toThrow(/invalid or corrupt/i);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
