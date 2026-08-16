import { stripInvalidPostgresChars } from "@/lib/sanitize-text";

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
 * content, so Truth Brain grounding is unaffected. Sanitized, but never
 * truncated here (Step 6): capacity-driven chunking happens once, at the
 * single choke point closest to the model call
 * (kai-extraction-engine.ts), not at every text-assembly stage upstream
 * of it.
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

  return stripInvalidPostgresChars(sections.join("\n\n"));
}
