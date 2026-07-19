import { describe, expect, it } from "vitest";
import { deepStripInvalidChars, stripInvalidPostgresChars } from "@/lib/sanitize-text";

/**
 * Sprint 006 Bug 006: Postgres text/jsonb columns hard-reject a literal
 * NUL codepoint (U+0000) — "unsupported Unicode escape sequence ...
 * cannot be converted to text" (code 22P05) — reproduced live when a
 * rich-text email paste (Outlook/Word -> browser textarea) carried a NUL
 * byte through to the very first database write.
 */

const NUL = String.fromCharCode(0x00);

describe("stripInvalidPostgresChars", () => {
  it("removes a literal NUL byte", () => {
    const input = `Hello${NUL}World`;
    expect(stripInvalidPostgresChars(input)).toBe("HelloWorld");
    expect(stripInvalidPostgresChars(input)).not.toContain(NUL);
  });

  it("removes other non-printable C0 control characters", () => {
    const input = "Line1\x01\x02\x1FLine2";
    expect(stripInvalidPostgresChars(input)).toBe("Line1Line2");
  });

  it("keeps legitimate whitespace: tab, newline, carriage return", () => {
    const input = "Line1\tTabbed\nNewline\r\n";
    expect(stripInvalidPostgresChars(input)).toBe(input);
  });

  it("leaves ordinary text — including real recruitment content — completely unchanged", () => {
    const input = "Electrical Technician — SAR 1400-2000, Oil & Gas industry, 2–3 years experience.";
    expect(stripInvalidPostgresChars(input)).toBe(input);
  });

  it("leaves real Unicode (non-control) characters untouched, e.g. em dash, Arabic, emoji-adjacent marks", () => {
    const input = "Saudi Arabia — متطلبات التوظيف — 20 positions";
    expect(stripInvalidPostgresChars(input)).toBe(input);
  });

  it("is a no-op on a string with nothing to strip", () => {
    const input = "Perfectly normal text.";
    expect(stripInvalidPostgresChars(input)).toBe(input);
  });
});

describe("deepStripInvalidChars — recursive, for jsonb payloads", () => {
  it("strips a NUL byte nested inside an object, array, and string leaf alike", () => {
    const input = {
      header: `Electrical Technician${NUL}`,
      positions: [
        { title: `CP Tester${NUL}`, count: 5 },
        { title: "Safety Officer", count: 5 },
      ],
      warnings: [`Note${NUL}here`],
      count: 42,
      active: true,
      missing: null,
    };
    const cleaned = deepStripInvalidChars(input);
    expect(cleaned.header).toBe("Electrical Technician");
    expect(cleaned.positions[0].title).toBe("CP Tester");
    expect(cleaned.positions[1].title).toBe("Safety Officer");
    expect(cleaned.warnings[0]).toBe("Notehere");
    // Non-string values pass through untouched.
    expect(cleaned.count).toBe(42);
    expect(cleaned.active).toBe(true);
    expect(cleaned.missing).toBeNull();
  });

  it("handles the exact shape of an AI ExtractionResult (originalSourceText echoing a NUL from the source)", () => {
    const extraction = {
      country: { value: "Saudi Arabia", confidence: "HIGH" },
      employer: { value: null, confidence: "LOW" },
      positions: [
        {
          title: "Electrical Technician",
          tradeSummary: `Electrical maintenance${NUL} in oil & gas facilities.`,
          quantity: { value: 20, confidence: "HIGH" },
        },
      ],
      originalSourceText: `Dear All,${NUL}\n\nGreetings from Mohamed Alarji Contracting Company!`,
      warnings: [],
    };
    const cleaned = deepStripInvalidChars(extraction);
    expect(JSON.stringify(cleaned)).not.toContain(NUL);
    expect(cleaned.positions[0].tradeSummary).toBe("Electrical maintenance in oil & gas facilities.");
    expect(cleaned.originalSourceText).toContain("Mohamed Alarji Contracting Company");
  });

  it("never fabricates or drops a field — only removes invalid characters", () => {
    const input = { a: "clean", b: { c: "also clean" }, d: [1, 2, 3] };
    expect(deepStripInvalidChars(input)).toEqual(input);
  });
});
