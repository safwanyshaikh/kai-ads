import { describe, expect, it, beforeAll, afterAll } from "vitest";
import nodeModule from "node:module";
import { processDocument } from "@/server/ai/document-processing.service";

/**
 * pdf-parse transitively imports pdfjs-dist/legacy/build/pdf.mjs, whose
 * bundled canvas.js module runs `const SCALE_MATRIX = new DOMMatrix();`
 * at TOP LEVEL — evaluated the instant that module is imported, before
 * any text extraction happens. Node has no global DOMMatrix; pdfjs-dist's
 * own fallback polyfill requires the optional @napi-rs/canvas native
 * package, which is excluded from Vercel's serverless function bundle
 * (the same class of issue as FIX-009's pdf-parse dynamic-import fix), so
 * on Vercel that require throws, the polyfill silently no-ops, and every
 * PDF upload failed with a raw, uncaught "DOMMatrix is not defined" that
 * bypassed extractPdfText's friendly error handling entirely (it's thrown
 * during the dynamic `import("pdf-parse")` itself, before the try/catch
 * is even entered). See src/server/ai/pdf-dommatrix-polyfill.ts.
 *
 * This file simulates that exact failure — @napi-rs/canvas unresolvable
 * — by hooking Node's own module resolver, and must be the FIRST thing
 * in this worker to import document-processing.service.ts's PDF path
 * (document-processing.service.ts only imports pdf-parse lazily, inside
 * extractPdfText, so no other test in this file/worker can have already
 * cached pdfjs-dist before this hook is installed).
 */
type ResolveFilename = (request: string, ...rest: unknown[]) => string;
const moduleWithResolve = nodeModule as unknown as { _resolveFilename: ResolveFilename };
let originalResolveFilename: ResolveFilename;

beforeAll(() => {
  originalResolveFilename = moduleWithResolve._resolveFilename;
  moduleWithResolve._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === "@napi-rs/canvas") {
      throw new Error("Cannot find module '@napi-rs/canvas' (simulated Vercel serverless bundle exclusion)");
    }
    return originalResolveFilename.apply(this, [request, ...rest]);
  };
  delete (globalThis as { DOMMatrix?: unknown }).DOMMatrix;
});

afterAll(() => {
  moduleWithResolve._resolveFilename = originalResolveFilename;
});

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

describe("PDF text extraction survives @napi-rs/canvas being unresolvable (the exact Vercel failure)", () => {
  it("extracts real text instead of throwing 'DOMMatrix is not defined'", async () => {
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

  it("globalThis.DOMMatrix is polyfilled instead of left undefined", () => {
    expect(typeof globalThis.DOMMatrix).not.toBe("undefined");
  });
});
