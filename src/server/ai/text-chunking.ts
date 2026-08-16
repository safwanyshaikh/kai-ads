/**
 * Step 6 — deterministic source-text chunking.
 *
 * MAX_INPUT_CHARS/MAX_MERGED_CHARS/MAX_EXTRACTED_CHARS previously each
 * silently truncated with `.slice(0, N)`, discarding whatever fell past
 * character 20,000 with no warning. That number was never actually a
 * provider limit — it was just "don't send unnecessary content" — so
 * raising it to a bigger arbitrary number would trade one unverified
 * truncation point for another. This keeps 20,000 as what it always was
 * (a safe, already-exercised-in-production single-call size) and uses it
 * as a CHUNK size instead of a hard cutoff: text longer than that is split
 * into ordered chunks, every chunk is sent to the model, and the
 * structured results are merged back together (see extraction-merge.ts).
 * Nothing past this boundary is ever discarded again.
 */

/** Per-call chunk size — unchanged from the prior MAX_INPUT_CHARS/MAX_MERGED_CHARS/MAX_EXTRACTED_CHARS value. */
export const EXTRACTION_CHUNK_CHARS = 20000;

export interface TextChunk {
  index: number;
  text: string;
  startChar: number;
  endChar: number;
}

/**
 * Splits `text` into ordered, non-overlapping chunks no larger than
 * `maxChunkChars`. Prefers breaking on a paragraph boundary, then a line
 * boundary, within the trailing window of each chunk, so a boundary is
 * unlikely to land mid-sentence or mid-position-line; falls back to a hard
 * cut only when no such boundary exists in that window. Deterministic:
 * identical input always produces identical chunk boundaries.
 */
export function chunkText(text: string, maxChunkChars: number = EXTRACTION_CHUNK_CHARS): TextChunk[] {
  if (text.length <= maxChunkChars) {
    return [{ index: 0, text, startChar: 0, endChar: text.length }];
  }

  const chunks: TextChunk[] = [];
  let pos = 0;
  while (pos < text.length) {
    const hardEnd = Math.min(pos + maxChunkChars, text.length);
    let end = hardEnd;

    if (hardEnd < text.length) {
      const window = text.slice(pos, hardEnd);
      const lastParagraph = window.lastIndexOf("\n\n");
      const lastLine = window.lastIndexOf("\n");
      const breakAt = lastParagraph > 0 ? lastParagraph + 2 : lastLine > 0 ? lastLine + 1 : -1;
      if (breakAt > 0) {
        end = pos + breakAt;
      }
    }

    chunks.push({ index: chunks.length, text: text.slice(pos, end), startChar: pos, endChar: end });
    pos = end;
  }
  return chunks;
}
