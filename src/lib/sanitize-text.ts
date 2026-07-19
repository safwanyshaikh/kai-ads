/**
 * Sprint 006 Bug 006: Postgres (and its JSON/JSONB codec) hard-rejects a
 * literal NUL codepoint (U+0000) anywhere inside a text or jsonb value —
 * "unsupported Unicode escape sequence ... cannot be converted to text"
 * (code 22P05). This is not an application bug to work around per write
 * site; it is a property of the storage layer, so every piece of free
 * text that can reach Postgres — a pasted requirement, text extracted
 * from an uploaded PDF/DOCX, or a field GPT echoes back in its
 * structured extraction — must be sanitized once, at the boundary,
 * before it is ever handed to Prisma.
 *
 * Malformed PDF text streams and rich-text paste (Outlook/Word -> browser
 * textarea) are the two realistic sources of a stray NUL or other C0
 * control character reaching this app; both are covered by applying
 * this at every text-ingestion boundary (see callers).
 *
 * Built via the RegExp constructor from an escaped string, not a
 * /regex/ literal, so the control-character escapes stay as source text
 * (backslash + digits) rather than risking literal control bytes ending
 * up in this file.
 */
const INVALID_POSTGRES_CHARS = new RegExp("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]", "g");

/** Strips characters Postgres text/jsonb columns cannot store. Safe to call on any string, including ones with none. */
export function stripInvalidPostgresChars(text: string): string {
  return text.replace(INVALID_POSTGRES_CHARS, "");
}

/**
 * Recursively applies stripInvalidPostgresChars to every string leaf of
 * an arbitrary JSON-shaped value (objects, arrays, primitives) — used
 * before persisting the AI extraction result (a `Json`/`jsonb` Prisma
 * column) to guarantee no field GPT echoed back can carry a NUL into
 * the database, regardless of which field it ended up in.
 */
export function deepStripInvalidChars<T>(value: T): T {
  if (typeof value === "string") {
    return stripInvalidPostgresChars(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepStripInvalidChars(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      result[key] = deepStripInvalidChars(v);
    }
    return result as T;
  }
  return value;
}
