import { createHash } from "node:crypto";
import {
  PRIVATE_OR_LOOPBACK_HOSTNAME_PATTERNS,
  processDocument,
} from "@/server/ai/document-processing.service";
import { UnsupportedDocumentError } from "@/server/ai/openai/errors";
import { getTranscriptionProvider } from "@/server/ai/audio";
import { stripInvalidPostgresChars } from "@/lib/sanitize-text";
import { createLogger } from "@/lib/logger";
import type { RequirementSourceKind } from "./requirement-provenance";

const log = createLogger("requirement-source");

/**
 * Requirement Intelligence — intake.
 *
 * Task 002: "Accept any recruitment requirement from WhatsApp, PDF,
 * Image, Voice Note, Email, Word, Excel, Google Sheet, Website."
 *
 * This module's only job is to reduce every one of those channels to the
 * two things the extraction engine already understands: TEXT or an IMAGE.
 * It deliberately performs NO extraction and NO interpretation — a
 * spreadsheet becomes a faithful text rendering of its cells, an email
 * becomes its body, a voice note becomes its transcript. What those words
 * MEAN is decided downstream by the existing KAI Intelligence Engine, so
 * there is still exactly one extraction implementation.
 *
 * PDF, Word, and image handling is delegated to the existing
 * document-processing.service.ts rather than reimplemented, so the
 * hard-won fixes living there (the DOMMatrix polyfill, the corrupt-file
 * messages, the NUL-byte stripping) apply to every channel.
 */

const MAX_EXTRACTED_CHARS = 20000; // mirrors document-processing.service.ts
const MAX_FETCH_BYTES = 15 * 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // provider's own upload ceiling
const MAX_SHEET_ROWS = 2000;
const MAX_SHEET_COLUMNS = 60;

/** One inbound requirement artifact, before any reading has happened. */
export type RequirementSourceInput =
  | { kind: "PLAIN_TEXT" | "WHATSAPP_TEXT" | "EMAIL"; text: string; label?: string }
  | { kind: "WEBSITE" | "GOOGLE_SHEET"; url: string; label?: string }
  | {
      kind: "PDF" | "WORD" | "IMAGE" | "WHATSAPP_SCREENSHOT" | "EXCEL" | "VOICE_NOTE";
      data: Buffer;
      mimeType: string;
      fileName: string;
      label?: string;
    };

/** What a source reduced to, ready for the extraction engine. */
export interface ReadRequirementSource {
  kind: RequirementSourceKind;
  /** Stable identity of the artifact — sha256 of its bytes or text. */
  contentHash: string;
  /** Human label for provenance, e.g. "demand-letter.pdf", "sheet 'Demand'". */
  label: string;
  content:
    | { type: "text"; text: string }
    | { type: "image"; base64: string; mimeType: string };
  /** Non-fatal notes about how this source was read — surfaced, never hidden. */
  notes: string[];
}

/** A source that could not be read. Never throws the whole intake away. */
export interface UnreadableRequirementSource {
  kind: RequirementSourceKind;
  label: string;
  error: string;
}

export interface ReadSourcesOutcome {
  sources: ReadRequirementSource[];
  unreadable: UnreadableRequirementSource[];
}

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

const truncate = (text: string) => stripInvalidPostgresChars(text).slice(0, MAX_EXTRACTED_CHARS);

/**
 * SSRF guard for EXTERNAL requirement sources.
 *
 * document-processing.service.ts's assertSafeSourceUrl allows ONLY our
 * own storage hosts, which is right for an uploaded file but rejects
 * every legitimate public web page and Google Sheet. This guard has the
 * opposite shape — any public host is fine, private space never is — and
 * shares the blocklist with that module so the two can never disagree
 * about what "private" means.
 *
 * Redirects are the subtle risk: a public URL that 302s to
 * 169.254.169.254 defeats a check performed only on the original URL, so
 * fetches using this guard follow no redirects and re-validate manually.
 */
export function assertPublicRequirementUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsupportedDocumentError("That requirement link is not a valid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsupportedDocumentError("A requirement link must be an http(s) URL.");
  }

  if (PRIVATE_OR_LOOPBACK_HOSTNAME_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    log.error({ hostname: url.hostname }, "Rejected requirement URL pointing at a private/loopback host");
    throw new UnsupportedDocumentError("That requirement link points to a private address and cannot be read.");
  }

  return url;
}

/** Fetches an external URL, re-validating every redirect hop against the guard. */
async function fetchExternal(rawUrl: string, accept: string): Promise<{ body: Buffer; contentType: string; finalUrl: string }> {
  let current = assertPublicRequirementUrl(rawUrl).toString();

  for (let hop = 0; hop < 5; hop += 1) {
    const response = await fetch(current, { redirect: "manual", headers: { accept } });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      // Re-validate: a public URL redirecting into private space is the
      // whole reason redirects are followed manually here.
      current = assertPublicRequirementUrl(new URL(location, current).toString()).toString();
      continue;
    }

    if (!response.ok) {
      throw new UnsupportedDocumentError(`That requirement link could not be read (HTTP ${response.status}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_FETCH_BYTES) {
      throw new UnsupportedDocumentError("That requirement link returned more than 15MB.");
    }
    return { body: buffer, contentType: response.headers.get("content-type") ?? "", finalUrl: current };
  }

  throw new UnsupportedDocumentError("That requirement link redirected too many times.");
}

/**
 * Converts a Google Sheets UI URL into its CSV export URL.
 *
 * Recruiters paste the link from their browser bar, which is an /edit
 * URL that returns an HTML application shell, not data. Deterministic
 * rewrite, no API key, no OAuth — it works for any sheet the agency has
 * shared link-readable, and fails honestly for anything private.
 */
export function toGoogleSheetCsvUrl(rawUrl: string): string | null {
  const match = rawUrl.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;
  const documentId = match[1];
  const gidMatch = rawUrl.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${documentId}/export?format=csv&gid=${gid}`;
}

/**
 * Strips HTML to readable text.
 *
 * Script/style/nav/footer content is removed first — a job page's
 * navigation menu is not part of the requirement, and feeding it to the
 * extractor invites it to read a menu item as a job title. Block-level
 * tags become newlines so the table structure of a typical vacancy
 * listing survives as line structure.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]\s*>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Renders CSV as a tab-separated text table.
 *
 * Handles quoted fields containing commas and newlines, because a
 * "Salary" column reading `"SAR 3,200"` is completely routine and a naive
 * split on commas turns one salary into two columns and corrupts every
 * field after it on that row.
 */
export function csvToTable(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Renders a grid as a text table the extractor can read positionally. */
export function gridToText(grid: string[][], sheetName?: string): string {
  const header = sheetName ? `# Sheet: ${sheetName}\n` : "";
  const body = grid
    .slice(0, MAX_SHEET_ROWS)
    .map((row) => row.slice(0, MAX_SHEET_COLUMNS).map((cell) => cell.trim()).join("\t"))
    .join("\n");
  return `${header}${body}`.trim();
}

/**
 * Reads an Excel workbook into text, one labelled block per sheet.
 *
 * exceljs is imported dynamically for the same reason pdf-parse is (see
 * FIX-009 in document-processing.service.ts): a static import drags the
 * whole dependency into every caller of this module, including the
 * plain-text path that has no spreadsheet anywhere near it.
 *
 * EVERY sheet is read, not just the first. Overseas demand workbooks
 * routinely put the trades on one tab and the salary scale on another,
 * and reading only sheet 1 silently loses half the requirement.
 */
async function readExcel(data: Buffer): Promise<{ text: string; notes: string[] }> {
  const notes: string[] = [];
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();

  try {
    await workbook.xlsx.load(data as unknown as ArrayBuffer);
  } catch (error) {
    log.warn({ err: error }, "Excel workbook appears corrupt or unreadable");
    throw new UnsupportedDocumentError(
      "This Excel file could not be read. It may be corrupt, password-protected, or in the older .xls format — re-save it as .xlsx and try again.",
    );
  }

  const blocks: string[] = [];
  workbook.eachSheet((sheet) => {
    const grid: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (excelRow) => {
      const cells: string[] = [];
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value;
        if (value === null || value === undefined) {
          cells.push("");
        } else if (typeof value === "object" && value !== null && "result" in value) {
          // A formula cell: take the computed result, never the formula
          // text — "=B2*C2" is not a salary.
          cells.push(String((value as { result?: unknown }).result ?? ""));
        } else if (typeof value === "object" && value !== null && "richText" in value) {
          cells.push(
            ((value as { richText: { text: string }[] }).richText ?? []).map((part) => part.text).join(""),
          );
        } else if (value instanceof Date) {
          cells.push(value.toISOString().slice(0, 10));
        } else {
          cells.push(String(value));
        }
      });
      if (cells.some((cell) => cell.trim().length > 0)) grid.push(cells);
    });

    if (grid.length === 0) {
      notes.push(`Sheet "${sheet.name}" is empty and was skipped.`);
      return;
    }
    if (grid.length > MAX_SHEET_ROWS) {
      notes.push(`Sheet "${sheet.name}" has ${grid.length} rows; only the first ${MAX_SHEET_ROWS} were read.`);
    }
    blocks.push(gridToText(grid, sheet.name));
  });

  if (blocks.length === 0) {
    throw new UnsupportedDocumentError("This Excel file contains no readable data.");
  }

  return { text: blocks.join("\n\n"), notes };
}

/**
 * Strips quoted reply chains and signatures from an email body.
 *
 * A forwarded requirement usually carries three older messages beneath
 * it, and those older messages routinely contain a DIFFERENT, superseded
 * requirement. Feeding the whole chain to the extractor is how last
 * month's salary ends up on this month's advertisement.
 */
export function stripEmailQuotedChain(body: string): { text: string; trimmed: boolean } {
  const markers = [
    /^\s*-{2,}\s*Original Message\s*-{2,}/im,
    /^\s*On .{5,80}\bwrote:\s*$/im,
    /^\s*From:\s*.+$/im,
    /^\s*_{5,}\s*$/m,
    /^\s*--\s*$/m,
  ];

  let cutAt = body.length;
  for (const marker of markers) {
    const match = body.match(marker);
    if (match?.index !== undefined && match.index < cutAt && match.index > 0) {
      cutAt = match.index;
    }
  }

  const text = body.slice(0, cutAt).trim();
  // Never return nothing: if the heuristics would eat the whole message,
  // the original wins. Losing a signature is fine; losing the requirement
  // is not.
  if (text.length === 0) return { text: body.trim(), trimmed: false };
  return { text, trimmed: cutAt < body.length };
}

/** Reads one source. Never throws — failures are returned so siblings still process. */
async function readOne(
  input: RequirementSourceInput,
): Promise<ReadRequirementSource | UnreadableRequirementSource> {
  const label = input.label ?? defaultLabel(input);

  try {
    switch (input.kind) {
      case "PLAIN_TEXT":
      case "WHATSAPP_TEXT": {
        const text = truncate(input.text);
        if (text.trim().length === 0) throw new UnsupportedDocumentError("This message contains no text.");
        return { kind: input.kind, contentHash: sha256(input.text), label, content: { type: "text", text }, notes: [] };
      }

      case "EMAIL": {
        const { text: stripped, trimmed } = stripEmailQuotedChain(input.text);
        const text = truncate(stripped);
        if (text.trim().length === 0) throw new UnsupportedDocumentError("This email contains no readable body.");
        return {
          kind: "EMAIL",
          contentHash: sha256(input.text),
          label,
          content: { type: "text", text },
          notes: trimmed ? ["Quoted reply chain and signature were excluded so an older requirement in the thread cannot be read as this one."] : [],
        };
      }

      case "WEBSITE": {
        const { body, finalUrl } = await fetchExternal(input.url, "text/html,application/xhtml+xml");
        const text = truncate(htmlToText(body.toString("utf8")));
        if (text.trim().length === 0) {
          throw new UnsupportedDocumentError("That web page contained no readable text — it may require sign-in or run entirely in JavaScript.");
        }
        return {
          kind: "WEBSITE",
          contentHash: sha256(body),
          label,
          content: { type: "text", text },
          notes: finalUrl !== input.url ? [`Followed a redirect to ${finalUrl}.`] : [],
        };
      }

      case "GOOGLE_SHEET": {
        const csvUrl = toGoogleSheetCsvUrl(input.url);
        if (!csvUrl) {
          throw new UnsupportedDocumentError("That does not look like a Google Sheets link.");
        }
        const { body, contentType } = await fetchExternal(csvUrl, "text/csv");
        if (contentType.includes("text/html")) {
          throw new UnsupportedDocumentError(
            "That Google Sheet is not link-readable — open it, choose Share, and allow anyone with the link to view it.",
          );
        }
        const grid = csvToTable(body.toString("utf8"));
        if (grid.length === 0) throw new UnsupportedDocumentError("That Google Sheet is empty.");
        return {
          kind: "GOOGLE_SHEET",
          contentHash: sha256(body),
          label,
          content: { type: "text", text: truncate(gridToText(grid)) },
          notes: grid.length > MAX_SHEET_ROWS ? [`Sheet has ${grid.length} rows; only the first ${MAX_SHEET_ROWS} were read.`] : [],
        };
      }

      case "EXCEL": {
        const { text, notes } = await readExcel(input.data);
        return { kind: "EXCEL", contentHash: sha256(input.data), label, content: { type: "text", text: truncate(text) }, notes };
      }

      case "VOICE_NOTE": {
        if (input.data.byteLength > MAX_AUDIO_BYTES) {
          throw new UnsupportedDocumentError("This voice note is larger than 25MB.");
        }
        const provider = getTranscriptionProvider();
        if (!provider) {
          throw new UnsupportedDocumentError(
            "Voice notes cannot be read because transcription is not configured. Forward the requirement as text and it will be processed normally.",
          );
        }
        const { text: transcript } = await provider.transcribe({
          audio: input.data,
          mimeType: input.mimeType,
          fileName: input.fileName,
        });
        const text = truncate(transcript);
        if (text.trim().length === 0) {
          throw new UnsupportedDocumentError("Nothing could be transcribed from this voice note.");
        }
        return {
          kind: "VOICE_NOTE",
          contentHash: sha256(input.data),
          label,
          content: { type: "text", text },
          notes: ["Transcribed from speech. Numbers and proper nouns are the least reliable part of any transcript — every figure below is scored accordingly."],
        };
      }

      case "PDF":
      case "WORD":
      case "IMAGE":
      case "WHATSAPP_SCREENSHOT": {
        // Delegated to the existing document engine — not reimplemented.
        const processed = await processDocument({
          data: input.data,
          mimeType: input.mimeType,
          fileName: input.fileName,
        });
        return {
          kind: input.kind,
          contentHash: sha256(input.data),
          label,
          content:
            processed.kind === "text"
              ? { type: "text", text: truncate(processed.text) }
              : { type: "image", base64: processed.base64, mimeType: processed.mimeType },
          notes: [],
        };
      }
    }
  } catch (error) {
    const message =
      error instanceof UnsupportedDocumentError
        ? error.message
        : "This source could not be read.";
    log.warn({ err: error, kind: input.kind }, "Requirement source unreadable");
    return { kind: input.kind, label, error: message };
  }
}

function defaultLabel(input: RequirementSourceInput): string {
  if ("fileName" in input) return input.fileName;
  if ("url" in input) return input.url;
  return input.kind.toLowerCase().replace(/_/g, " ");
}

/**
 * Reads every inbound source.
 *
 * Sources are read concurrently and independently: one unreadable
 * attachment among five must never cost the recruiter the other four. The
 * unreadable ones come back named, with the reason, so the recruiter is
 * told what was ignored instead of quietly receiving a thinner
 * requirement than they sent.
 */
export async function readRequirementSources(
  inputs: RequirementSourceInput[],
): Promise<ReadSourcesOutcome> {
  const results = await Promise.all(inputs.map(readOne));

  const sources: ReadRequirementSource[] = [];
  const unreadable: UnreadableRequirementSource[] = [];
  const seenHashes = new Set<string>();

  for (const result of results) {
    if ("error" in result) {
      unreadable.push(result);
      continue;
    }
    // The same demand letter forwarded twice in one batch is one source.
    if (seenHashes.has(result.contentHash)) continue;
    seenHashes.add(result.contentHash);
    sources.push(result);
  }

  return { sources, unreadable };
}
