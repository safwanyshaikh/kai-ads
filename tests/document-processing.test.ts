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
      ).rejects.toThrow(/could not be read/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
