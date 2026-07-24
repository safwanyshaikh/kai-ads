import { stripInvalidPostgresChars } from "@/lib/sanitize-text";

/**
 * Mirrors document-processing.service's MAX_EXTRACTED_CHARS and the
 * kai-extraction-engine's MAX_INPUT_CHARS: the merged multi-source text
 * is capped to the same budget a single source already gets, so the
 * composer never sends the provider more than any existing path does.
 */
const MAX_MERGED_CHARS = 20000;

export interface AttachmentText {
  fileName: string;
  text: string;
}

/**
 * ChatGPT-style composer (Supreme Constitution Principle 12): one draft
 * can carry typed instructions, a pasted requirement, AND several
 * document attachments at once — but the KAI Intelligence Engine takes a
 * single text input. This is the one place those sources become that
 * input, deliberately a pure function (no fetching, no OpenAI) so the
 * merge order and labeling are unit-testable in isolation.
 *
 * Merge order is fixed: instructions first (the recruiter's explicit
 * guidance should frame everything after it), then the pasted
 * requirement, then each attachment's extracted text under a labeled
 * separator. The labels only say where text came from — they never add
 * content, so Truth Brain grounding is unaffected. Everything is
 * sanitized and capped exactly like the single-source paths.
 */
export function buildMergedExtractionText(parts: {
  instructions?: string | null;
  rawText?: string | null;
  attachmentTexts?: AttachmentText[];
}): string {
  const sections: string[] = [];

  const instructions = parts.instructions?.trim();
  if (instructions) {
    sections.push(`RECRUITER INSTRUCTIONS:\n${instructions}`);
  }

  const rawText = parts.rawText?.trim();
  if (rawText) {
    sections.push(rawText);
  }

  for (const attachment of parts.attachmentTexts ?? []) {
    const text = attachment.text.trim();
    if (!text) continue;
    sections.push(`--- ATTACHMENT: ${attachment.fileName} ---\n${text}`);
  }

  return stripInvalidPostgresChars(sections.join("\n\n")).slice(0, MAX_MERGED_CHARS);
}
