import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { UnsupportedDocumentError } from "./openai/errors";
import { createLogger } from "@/lib/logger";
import { getEnv } from "@/lib/env";

const log = createLogger("document-processing");

const MAX_FILE_BYTES = 15 * 1024 * 1024; // matches storageService's advertisement-source limit
const MAX_EXTRACTED_CHARS = 20000; // mirrors kai-extraction-engine's MAX_INPUT_CHARS

type DocumentProcessingResult =
  | { kind: "text"; text: string }
  | { kind: "image"; base64: string; mimeType: string };

const PRIVATE_OR_LOOPBACK_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^169\.254\./, // link-local — includes cloud metadata endpoints (e.g. AWS 169.254.169.254)
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
];

/**
 * SSRF guard: `sourceFileUrl` reaches this code from a Zod-validated but
 * otherwise unrestricted string (AdvertisementDraft.sourceFileUrl —
 * ultimately client-supplied via POST /api/advertisement-drafts). Without
 * this check, a request could point our server at an internal service or
 * a cloud metadata endpoint and have it "helpfully" fetched and read back
 * as if it were a recruitment document. Only http(s) URLs whose host
 * matches our own configured storage are ever fetched.
 */
function assertSafeSourceUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsupportedDocumentError("The uploaded file's location is not a valid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsupportedDocumentError("The uploaded file must be served over HTTP(S).");
  }

  if (PRIVATE_OR_LOOPBACK_HOSTNAME_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    log.error({ hostname: url.hostname }, "Rejected sourceFileUrl pointing at a private/loopback host");
    throw new UnsupportedDocumentError("The uploaded file's location is not allowed.");
  }

  const env = getEnv();
  const allowedHosts = [env.STORAGE_PUBLIC_URL, env.STORAGE_ENDPOINT]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).hostname;
      } catch {
        return null;
      }
    })
    .filter((host): host is string => Boolean(host));

  // Vercel Blob URLs are host-per-store and not derivable from a single
  // configured value; allow its known domain suffix when that provider is active.
  const allowVercelBlob =
    env.STORAGE_PROVIDER === "vercel-blob" && url.hostname.endsWith(".public.blob.vercel-storage.com");

  const isAllowedHost = allowedHosts.includes(url.hostname) || allowVercelBlob;

  if (!isAllowedHost) {
    log.error(
      { hostname: url.hostname, allowedHosts },
      "Rejected sourceFileUrl that does not match configured storage",
    );
    throw new UnsupportedDocumentError("The uploaded file's location is not recognized.");
  }

  return url;
}

/**
 * Sniffs an image's real MIME type from its magic bytes rather than
 * trusting a client-supplied value or requiring an extra database column
 * on AdvertisementDraft to remember what was uploaded. PNG/JPEG/WEBP are
 * the only three this app accepts (see storageService's allow-list).
 */
function sniffImageMimeType(data: Buffer): string {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return "image/png";
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  throw new UnsupportedDocumentError(
    "This file doesn't look like a PNG, JPEG, or WEBP image — it may be corrupt.",
  );
}

/**
 * Fetches an uploaded file (PDF/DOCX/Image/WhatsApp Screenshot) from
 * storage by URL and runs it through processDocument(). The URL must
 * resolve to our own configured storage (see assertSafeSourceUrl) — this
 * deliberately doesn't depend on a specific StorageProvider's download
 * API, only on the URL it already returned, but it is not an arbitrary
 * fetch of anything the client asks for.
 */
export async function fetchAndProcessSourceFile(
  sourceFileUrl: string,
  sourceType: "PDF" | "DOCX" | "IMAGE" | "WHATSAPP_SCREENSHOT",
): Promise<DocumentProcessingResult> {
  const safeUrl = assertSafeSourceUrl(sourceFileUrl);

  const response = await fetch(safeUrl);
  if (!response.ok) {
    throw new UnsupportedDocumentError("The uploaded file could not be retrieved from storage.");
  }
  const data = Buffer.from(await response.arrayBuffer());

  const mimeType =
    sourceType === "PDF"
      ? "application/pdf"
      : sourceType === "DOCX"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : sniffImageMimeType(data);

  return processDocument({ data, mimeType, fileName: sourceFileUrl });
}

/**
 * Input Processing (Sprint 003): "Use the appropriate extraction method
 * based on file type. Do not send unnecessary content to the AI
 * provider. Validate MIME type, file size, empty files, corrupt files."
 *
 * PDF and DOCX are converted to plain text here (so the KAI Intelligence
 * Engine only ever receives text or an image, never a raw file it has to
 * parse itself). PNG/JPG/JPEG/WEBP (including WhatsApp screenshots) are
 * validated and passed through for the vision model to read directly.
 */
export async function processDocument(file: {
  data: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<DocumentProcessingResult> {
  if (file.data.byteLength === 0) {
    throw new UnsupportedDocumentError("The uploaded file is empty.");
  }
  if (file.data.byteLength > MAX_FILE_BYTES) {
    throw new UnsupportedDocumentError("The uploaded file is larger than 15MB.");
  }

  switch (file.mimeType) {
    case "application/pdf":
      return { kind: "text", text: await extractPdfText(file.data) };

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return { kind: "text", text: await extractDocxText(file.data) };

    case "image/png":
    case "image/jpeg":
    case "image/webp":
      return { kind: "image", base64: file.data.toString("base64"), mimeType: file.mimeType };

    default:
      throw new UnsupportedDocumentError(
        `Unsupported file type "${file.mimeType}". Upload a PDF, DOCX, PNG, JPEG, or WEBP.`,
      );
  }
}

async function extractPdfText(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const text = result.text?.trim();
    if (!text) {
      throw new UnsupportedDocumentError(
        "No readable text was found in this PDF — it may be a scanned image. Try uploading it as an image instead.",
      );
    }
    return text.slice(0, MAX_EXTRACTED_CHARS);
  } catch (error) {
    if (error instanceof UnsupportedDocumentError) throw error;
    log.warn({ err: error }, "PDF appears corrupt or unparseable");
    throw new UnsupportedDocumentError(
      "This PDF could not be read. It may be corrupt, password-protected, or in an unsupported format.",
    );
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(data: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: data });
    const text = result.value?.trim();
    if (!text) {
      throw new UnsupportedDocumentError("No readable text was found in this DOCX file.");
    }
    return text.slice(0, MAX_EXTRACTED_CHARS);
  } catch (error) {
    if (error instanceof UnsupportedDocumentError) throw error;
    log.warn({ err: error }, "DOCX appears corrupt or unparseable");
    throw new UnsupportedDocumentError(
      "This DOCX file could not be read. It may be corrupt or in an unsupported format.",
    );
  }
}
