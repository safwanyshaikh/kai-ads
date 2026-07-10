/**
 * AI Extraction — Architecture Only (Sprint 002)
 *
 * These are provider-independent contracts. No GPT/OpenAI/Claude/etc.
 * implementation exists yet — see `NotImplementedAiProvider` in each
 * provider file for why, and `src/server/ai/index.ts` for how a real
 * implementation gets wired in later without touching any call site.
 *
 * Every provider takes a `raw input` (pasted text, or extracted text from
 * an uploaded PDF/DOCX/image/WhatsApp screenshot — OCR/parsing of those
 * formats is itself a future-sprint concern, out of scope here) and
 * returns a typed, confidence-scored result. Providers never throw for
 * "couldn't find it" — they return `found: false`. They only throw for
 * actual failures (network error, provider not configured, etc).
 */

export interface AiExtractionInput {
  /** Plain text to extract from — already OCR'd/parsed if the source was a file. */
  text?: string;
  /** Set instead of `text` for image/WhatsApp-screenshot input — the vision model reads it directly. */
  imageBase64?: string;
  imageMimeType?: string;
  /** Optional hint about where the text came from, for provider tuning. */
  sourceType?: "PASTE_TEXT" | "PDF" | "DOCX" | "IMAGE" | "WHATSAPP_SCREENSHOT";
}

export interface AiExtractionResult<T> {
  found: boolean;
  value: T | null;
  /** 0–1 confidence score, when the provider can produce one. */
  confidence?: number;
}

/**
 * Thrown when a provider is invoked but has no real implementation
 * configured. This is NOT a "couldn't extract" result — it's a hard
 * stop so callers can't mistake an unconfigured provider for one that
 * genuinely searched and found nothing.
 */
export class AiProviderNotImplementedError extends Error {
  constructor(providerName: string) {
    super(
      `${providerName} has no implementation configured. Sprint 002 ships the provider architecture only — wire a real implementation (e.g. a GPT-backed provider) via AI_PROVIDER before calling this.`,
    );
    this.name = "AiProviderNotImplementedError";
  }
}
