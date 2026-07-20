/**
 * pdf-parse's PDF text extraction transitively imports
 * pdfjs-dist/legacy/build/pdf.mjs, whose `src/display/canvas.js` module
 * runs `const SCALE_MATRIX = new DOMMatrix();` at TOP LEVEL — evaluated
 * the instant that module is imported, regardless of whether text
 * extraction ever touches canvas rendering.
 *
 * Node has no built-in `DOMMatrix` global. pdfjs-dist knows this and
 * tries to polyfill it itself by requiring the optional `@napi-rs/canvas`
 * native package (see its `node_utils.js`) — but that package's native
 * binary is excluded from Vercel's serverless function bundle (the same
 * class of issue as the earlier pdf-parse dynamic-import fix), so on
 * Vercel that require throws, pdfjs-dist's own polyfill silently no-ops
 * with a `warn(...)` call, and `globalThis.DOMMatrix` stays undefined.
 * The `new DOMMatrix()` at module scope then throws a raw, uncaught
 * `ReferenceError: DOMMatrix is not defined` DURING THE IMPORT ITSELF —
 * before extractPdfText's try/catch is even entered — so every PDF
 * upload failed with that exact message leaking straight to the
 * recruiter instead of a friendly "could not be read" fallback.
 *
 * Fix: polyfill `globalThis.DOMMatrix` ourselves, before pdf-parse (and
 * therefore pdfjs-dist) is ever imported, with a pure-JS package that has
 * no native binary to be stripped from the bundle. pdfjs-dist's own
 * polyfill code checks `if (!globalThis.DOMMatrix)` first, so once this
 * runs, it never even attempts the failing `@napi-rs/canvas` require.
 *
 * Import this module for its side effect ONLY, before any `pdf-parse`
 * import (see document-processing.service.ts).
 */
// Ambient type declaration lives in src/types/thednp-dommatrix.d.ts —
// @thednp/dommatrix ships no usable types of its own.
import DOMMatrixPolyfill from "@thednp/dommatrix";

if (typeof globalThis.DOMMatrix === "undefined") {
  // The polyfill implements the subset of the DOMMatrix constructor
  // pdfjs-dist's text-extraction path actually needs; it is not a full
  // spec-compliant DOMMatrix (e.g. no invertSelf/preMultiplySelf), which
  // only matters for full page rendering — a code path this app never
  // reaches (see kai-extraction-engine.ts — text/metadata extraction only).
  globalThis.DOMMatrix = DOMMatrixPolyfill as unknown as typeof DOMMatrix;
}
