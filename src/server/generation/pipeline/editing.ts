import type { InterviewEvent } from "../interview-events";
import { hasDna } from "../dna/registry";
import type { AdvertisementDocument, DocumentFormat } from "./advertisement-document";
import type { FooterStyle } from "./footer-styles";
import type { AdInk, AdvertisementFacts } from "./types";

/**
 * The Editing Engine.
 *
 * Three laws, and every line below exists to keep them true:
 *
 *  1. **Editing edits JSON, never pixels.** An edit produces a new
 *     Advertisement JSON. The renderer then runs again from that document.
 *     Nothing in this file touches an image, and nothing in this file can:
 *     it has no image dependency to touch one with.
 *
 *  2. **Editing never calls AI.** Every function here is pure and
 *     synchronous. There is no provider, no fetch, no await. A recruiter
 *     correcting a salary gets a deterministic re-render, not a new
 *     generation with a different photograph and a new bill.
 *
 *  3. **An edit sets exactly what the recruiter supplied.** No field is
 *     inferred, completed, tidied or improved. Clearing a value clears it;
 *     it does not fall back to a plausible one. This is the Truth Brain at
 *     the editing boundary: KAI never becomes the author of a fact.
 *
 * The Golden Rule the schema was designed around — editing one block must
 * never affect another — holds structurally: each operation writes to one
 * named region of the document and returns a change record naming it, so
 * an edit's blast radius is a property of the type, not of a convention.
 */

export type AdvertisementSection =
  | "HEADER"
  | "COUNTRY_INDUSTRY"
  | "POSITIONS"
  | "BENEFITS"
  | "INTERVIEW"
  | "CONTACT"
  | "AGENCY_FOOTER"
  | "DESIGN";

export type Position = AdvertisementFacts["positions"][number];
export type Benefit = AdvertisementFacts["benefits"][number];
export type Contact = AdvertisementFacts["contact"];

export type EditOperation =
  | { type: "SET_HEADER"; value: string }
  | { type: "SET_EMPLOYER"; value: string | null }
  | { type: "SET_INDUSTRY"; value: string }
  | { type: "SET_COUNTRY"; value: string }
  | { type: "SET_PROJECT_TYPE"; value: string | null }
  | { type: "SET_VISA_TYPE"; value: string | null }
  | { type: "SET_DUTY_HOURS"; value: string | null }
  | { type: "SET_ROTATION"; value: string | null }
  | { type: "UPDATE_POSITION"; index: number; patch: Partial<Position> }
  | { type: "ADD_POSITION"; position: Position; index?: number }
  | { type: "REMOVE_POSITION"; index: number }
  | { type: "MOVE_POSITION"; from: number; to: number }
  | { type: "SET_BENEFITS"; benefits: Benefit[] }
  | { type: "SET_INTERVIEW"; events: InterviewEvent[] }
  | { type: "UPDATE_CONTACT"; patch: Partial<Contact> }
  | { type: "SET_LEGAL_DISCLAIMER"; value: string | null }
  | { type: "SET_FOOTER"; value: string | null }
  | { type: "SET_DESIGN_DNA"; dnaId: string }
  | { type: "SET_FOOTER_STYLE"; footerStyle: FooterStyle | null }
  | { type: "SET_INK"; ink: AdInk }
  | { type: "SET_FORMAT"; format: Partial<DocumentFormat> };

export interface EditChange {
  section: AdvertisementSection;
  /** Human-readable summary for the advertisement's history. */
  summary: string;
}

export class EditValidationError extends Error {
  readonly code = "EDIT_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "EditValidationError";
  }
}

export interface ApplyEditsResult {
  document: AdvertisementDocument;
  changes: EditChange[];
  /**
   * True when the edit changed nothing. Callers should skip the re-render
   * and skip writing a version — a no-op edit is not history.
   */
  unchanged: boolean;
}

/**
 * Applies operations to a document and returns a NEW document.
 *
 * The input is never mutated. That is not tidiness: the caller usually
 * still holds the previous revision to write into version history, and an
 * in-place edit would silently rewrite the record of what came before.
 */
export function applyEdits(document: AdvertisementDocument, operations: EditOperation[]): ApplyEditsResult {
  let facts: AdvertisementFacts = { ...document.facts };
  let design = { ...document.design };
  let format = { ...document.format };
  const changes: EditChange[] = [];

  for (const op of operations) {
    switch (op.type) {
      case "SET_HEADER": {
        const value = requireText(op.value, "header");
        if (value === facts.header) break;
        facts = { ...facts, header: value };
        changes.push({ section: "HEADER", summary: `Headline changed to "${value}".` });
        break;
      }
      case "SET_EMPLOYER": {
        const value = optionalText(op.value);
        if (value === (facts.employer ?? null)) break;
        facts = { ...facts, employer: value };
        changes.push({ section: "HEADER", summary: value ? `Employer set to "${value}".` : "Employer removed." });
        break;
      }
      case "SET_INDUSTRY": {
        const value = requireText(op.value, "industry");
        if (value === facts.industry) break;
        facts = { ...facts, industry: value };
        changes.push({ section: "COUNTRY_INDUSTRY", summary: `Industry changed to "${value}".` });
        break;
      }
      case "SET_COUNTRY": {
        const value = requireText(op.value, "country");
        if (value === facts.country) break;
        facts = { ...facts, country: value };
        changes.push({ section: "COUNTRY_INDUSTRY", summary: `Destination changed to "${value}".` });
        break;
      }
      case "SET_PROJECT_TYPE":
      case "SET_VISA_TYPE":
      case "SET_DUTY_HOURS":
      case "SET_ROTATION": {
        const field = (
          {
            SET_PROJECT_TYPE: "projectType",
            SET_VISA_TYPE: "visaType",
            SET_DUTY_HOURS: "dutyHours",
            SET_ROTATION: "rotation",
          } as const
        )[op.type];
        const value = optionalText(op.value);
        if (value === (facts[field] ?? null)) break;
        facts = { ...facts, [field]: value };
        changes.push({
          section: "COUNTRY_INDUSTRY",
          summary: value ? `${label(field)} set to "${value}".` : `${label(field)} removed.`,
        });
        break;
      }

      case "UPDATE_POSITION": {
        assertIndex(op.index, facts.positions.length, "position");
        const before = facts.positions[op.index];
        // A patch key present with `undefined` is a request to CLEAR the
        // field, not an absent instruction — spreading it would silently
        // keep the old value and the recruiter's deletion would not stick.
        const after: Position = { ...before, ...op.patch };
        if (after.title !== undefined) after.title = requireText(after.title, "position title");
        if (shallowEqual(before, after)) break;
        const positions = [...facts.positions];
        positions[op.index] = after;
        facts = { ...facts, positions };
        changes.push({ section: "POSITIONS", summary: `Position ${op.index + 1} ("${after.title}") edited.` });
        break;
      }
      case "ADD_POSITION": {
        const position = { ...op.position, title: requireText(op.position.title, "position title") };
        const positions = [...facts.positions];
        const at = op.index ?? positions.length;
        assertIndex(at, positions.length + 1, "position");
        positions.splice(at, 0, position);
        facts = { ...facts, positions };
        changes.push({ section: "POSITIONS", summary: `Position "${position.title}" added.` });
        break;
      }
      case "REMOVE_POSITION": {
        assertIndex(op.index, facts.positions.length, "position");
        if (facts.positions.length === 1) {
          throw new EditValidationError(
            "An advertisement must state at least one position — remove the advertisement instead of its last role.",
          );
        }
        const removed = facts.positions[op.index];
        const positions = facts.positions.filter((_, i) => i !== op.index);
        facts = { ...facts, positions };
        changes.push({ section: "POSITIONS", summary: `Position "${removed.title}" removed.` });
        break;
      }
      case "MOVE_POSITION": {
        assertIndex(op.from, facts.positions.length, "position");
        assertIndex(op.to, facts.positions.length, "position");
        if (op.from === op.to) break;
        const positions = [...facts.positions];
        const [moved] = positions.splice(op.from, 1);
        positions.splice(op.to, 0, moved);
        facts = { ...facts, positions };
        changes.push({
          section: "POSITIONS",
          summary: `Position "${moved.title}" moved from ${op.from + 1} to ${op.to + 1}.`,
        });
        break;
      }

      case "SET_BENEFITS": {
        const benefits = op.benefits.map((b) => ({ ...b, label: requireText(b.label, "benefit label") }));
        if (JSON.stringify(benefits) === JSON.stringify(facts.benefits)) break;
        facts = { ...facts, benefits };
        changes.push({ section: "BENEFITS", summary: `Benefits updated (${benefits.length} listed).` });
        break;
      }
      case "SET_INTERVIEW": {
        if (JSON.stringify(op.events) === JSON.stringify(facts.interview)) break;
        facts = { ...facts, interview: op.events };
        changes.push({ section: "INTERVIEW", summary: `Interview details updated (${op.events.length} listed).` });
        break;
      }
      case "UPDATE_CONTACT": {
        const contact: Contact = { ...facts.contact, ...op.patch };
        if (shallowEqual(facts.contact, contact)) break;
        facts = { ...facts, contact };
        changes.push({ section: "CONTACT", summary: "Contact details updated." });
        break;
      }
      case "SET_LEGAL_DISCLAIMER": {
        const value = optionalText(op.value);
        if (value === (facts.legalDisclaimer ?? null)) break;
        facts = { ...facts, legalDisclaimer: value };
        changes.push({ section: "AGENCY_FOOTER", summary: value ? "Legal disclaimer updated." : "Legal disclaimer removed." });
        break;
      }
      case "SET_FOOTER": {
        const value = optionalText(op.value);
        if (value === (facts.footer ?? null)) break;
        facts = { ...facts, footer: value };
        changes.push({ section: "AGENCY_FOOTER", summary: value ? "Footer text updated." : "Footer text removed." });
        break;
      }

      case "SET_DESIGN_DNA": {
        if (!hasDna(op.dnaId)) throw new EditValidationError(`Unknown Design DNA "${op.dnaId}".`);
        if (op.dnaId === design.dnaId) break;
        design = {
          ...design,
          dnaId: op.dnaId,
          dnaReason: "The recruiter selected this design.",
          dnaFromOverride: true,
        };
        changes.push({ section: "DESIGN", summary: `Design changed to ${op.dnaId}.` });
        break;
      }
      case "SET_FOOTER_STYLE": {
        if (op.footerStyle === design.footerStyle) break;
        design = { ...design, footerStyle: op.footerStyle };
        changes.push({
          section: "AGENCY_FOOTER",
          summary: op.footerStyle ? `Footer style set to ${op.footerStyle}.` : "Footer style returned to KAI's choice.",
        });
        break;
      }
      case "SET_INK": {
        if (op.ink === design.ink) break;
        design = { ...design, ink: op.ink };
        changes.push({ section: "DESIGN", summary: `Ink set to ${op.ink}.` });
        break;
      }
      case "SET_FORMAT": {
        const next = { ...format, ...op.format };
        if (next.widthPx <= 0 || next.heightPx <= 0) {
          throw new EditValidationError("Format dimensions must be positive.");
        }
        if (shallowEqual(format, next)) break;
        format = next;
        changes.push({ section: "DESIGN", summary: `Format set to ${next.widthPx}×${next.heightPx}.` });
        break;
      }
    }
  }

  if (changes.length === 0) {
    return { document, changes, unchanged: true };
  }

  return {
    document: {
      ...document,
      facts,
      design,
      format,
      // The artwork reference is deliberately carried through untouched.
      // That single line is what makes "editing never calls AI" true: the
      // re-render reuses the background that already exists.
      artwork: document.artwork,
      revision: document.revision + 1,
      updatedAt: new Date().toISOString(),
    },
    changes,
    unchanged: false,
  };
}

/**
 * Whether an edit needs new artwork.
 *
 * Always false, and it is a function rather than a constant so the answer
 * is written down where someone would look for it: no text edit changes
 * what the background photograph should depict, and a format change is
 * handled by re-fitting the artwork the advertisement already has. KAI
 * does not re-bill an agency for a corrected phone number.
 */
export function requiresArtworkRegeneration(): boolean {
  return false;
}

function requireText(value: string | undefined, field: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new EditValidationError(`${label(field)} cannot be empty.`);
  return trimmed;
}

/** Empty means ABSENT, and absent means the advertisement does not state it. */
function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertIndex(index: number, length: number, what: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= Math.max(length, 1)) {
    throw new EditValidationError(`No ${what} at index ${index}.`);
  }
}

function shallowEqual(a: object, b: object): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = (a as Record<string, unknown>)[k];
    const bv = (b as Record<string, unknown>)[k];
    if (Array.isArray(av) || Array.isArray(bv)) {
      if (JSON.stringify(av) !== JSON.stringify(bv)) return false;
      continue;
    }
    if (av !== bv) return false;
  }
  return true;
}

function label(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
