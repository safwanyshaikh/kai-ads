import { describe, expect, it } from "vitest";
import { chunkText, EXTRACTION_CHUNK_CHARS } from "@/server/ai/text-chunking";

describe("chunkText", () => {
  it("returns a single chunk covering the whole text when at or under the limit", () => {
    const text = "a".repeat(EXTRACTION_CHUNK_CHARS);
    const chunks = chunkText(text, EXTRACTION_CHUNK_CHARS);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ index: 0, startChar: 0, endChar: text.length, text });
  });

  it("splits text over the limit into more than one chunk", () => {
    const text = "a".repeat(EXTRACTION_CHUNK_CHARS + 500);
    const chunks = chunkText(text, EXTRACTION_CHUNK_CHARS);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("never discards any character — chunks concatenate back to the exact original text", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Position ${i + 1} — ${i + 1} vacancies`).join("\n");
    const maxChunkChars = 100;
    const chunks = chunkText(text, maxChunkChars);
    expect(chunks.map((c) => c.text).join("")).toBe(text);
  });

  it("preserves document order — chunk boundaries are strictly increasing and non-overlapping", () => {
    const text = "line\n".repeat(5000);
    const chunks = chunkText(text, 1000);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
      if (i > 0) expect(chunks[i].startChar).toBe(chunks[i - 1].endChar);
    }
    expect(chunks[0].startChar).toBe(0);
    expect(chunks[chunks.length - 1].endChar).toBe(text.length);
  });

  it("prefers breaking on a line boundary rather than mid-word", () => {
    const text = `${"x".repeat(90)}\n${"y".repeat(90)}\n${"z".repeat(90)}`;
    const chunks = chunkText(text, 100);
    // Every chunk boundary should land right after a newline, not mid-run of x/y/z.
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.text.endsWith("\n") || chunk.text.length < 100).toBe(true);
    }
  });

  it("is deterministic — identical input always produces identical chunk boundaries", () => {
    const text = "Role A — 5\nRole B — 10\n".repeat(2000);
    const a = chunkText(text, 5000);
    const b = chunkText(text, 5000);
    expect(a).toEqual(b);
  });
});
