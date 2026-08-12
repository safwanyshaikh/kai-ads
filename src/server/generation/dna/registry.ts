import {
  validateDesignDna,
  validateDnaGeometry,
  type DesignDNA,
  type DnaPack,
} from "./design-dna";
import { ALL_DNAS } from "./packs";

/**
 * The Design DNA Registry.
 *
 * Holds the production DNA library and hands the Rendering Engine one set
 * of values. It selects; it does not render. Selection is deterministic on
 * the requirement, so regenerating the same advertisement produces the
 * same design — a recruiter who reloads must not get a different poster.
 */

class DnaValidationError extends Error {
  constructor(problems: string[]) {
    super(`Design DNA library is invalid:\n  - ${problems.join("\n  - ")}`);
    this.name = "DnaValidationError";
  }
}

function buildRegistry(): Map<string, DesignDNA> {
  const problems: string[] = [];
  const map = new Map<string, DesignDNA>();

  for (const dna of ALL_DNAS) {
    if (map.has(dna.id)) problems.push(`${dna.id}: duplicate DNA id`);
    for (const v of validateDesignDna(dna)) {
      problems.push(
        `${dna.id}: contrast ${v.pair} is ${v.ratio}:1 (${v.foreground} on ${v.background}); ${v.required}:1 required`,
      );
    }
    problems.push(...validateDnaGeometry(dna));
    map.set(dna.id, dna);
  }

  // A DNA that fails the Contrast Law would render a fact the candidate
  // cannot read, which the Factual Integrity Law treats as an omission.
  // Failing at module load makes that impossible to ship.
  if (problems.length > 0) throw new DnaValidationError(problems);
  return map;
}

const REGISTRY = buildRegistry();

export function getDna(id: string): DesignDNA {
  const dna = REGISTRY.get(id);
  if (!dna) throw new Error(`Unknown Design DNA "${id}".`);
  return dna;
}

export function hasDna(id: string): boolean {
  return REGISTRY.has(id);
}

export function listDnas(pack?: DnaPack): DesignDNA[] {
  const all = [...REGISTRY.values()];
  return pack ? all.filter((d) => d.pack === pack) : all;
}

export function listPacks(): DnaPack[] {
  return [...new Set(listDnas().map((d) => d.pack))];
}

export interface DnaSelectionInput {
  industry?: string | null;
  country?: string | null;
  positionCount: number;
  /** Explicit print/newspaper destination — decides the composition outright. */
  printOrNewspaper?: boolean;
  /** Recruiter's explicit choice. Wins over everything else. */
  preferredDnaId?: string | null;
  /** Recruiter's pack preference, when they have not picked a single DNA. */
  preferredPack?: DnaPack | null;
  /**
   * Stable per-advertisement string (its id, or the agency name plus
   * header). Spreads a large campaign across the DNAs that suit it so an
   * agency's feed does not read as one poster stamped repeatedly, while
   * staying identical across re-runs of the same advertisement.
   */
  seed?: string | null;
}

export interface DnaSelection {
  dna: DesignDNA;
  /** Why this DNA was chosen — surfaced to the recruiter and analytics. */
  reason: string;
  fromOverride: boolean;
}

/**
 * Position count decides the composition, exactly as the engine's own
 * theme selection always has; the DNA then decides how that composition
 * looks. The two are deliberately separate: density is a property of the
 * requirement, style is a property of the campaign.
 */
export function selectDna(input: DnaSelectionInput): DnaSelection {
  if (input.preferredDnaId) {
    return { dna: getDna(input.preferredDnaId), reason: "The recruiter selected this design.", fromOverride: true };
  }

  const wantsDtp = Boolean(input.printOrNewspaper) || input.positionCount > 15;
  const composition = wantsDtp ? "AAT_DTP" : "PREMIUM_CAMPAIGN";

  let candidates = listDnas().filter((d) => d.composition === composition);

  if (input.preferredPack) {
    const inPack = candidates.filter((d) => d.pack === input.preferredPack);
    if (inPack.length > 0) candidates = inPack;
  }

  const industry = input.industry?.toLowerCase() ?? "";
  if (industry) {
    const matched = candidates.filter((d) => d.industries.some((i) => industry.includes(i.toLowerCase())));
    if (matched.length > 0) candidates = matched;
  }

  if (candidates.length === 0) candidates = listDnas().filter((d) => d.composition === composition);
  if (candidates.length === 0) candidates = listDnas();

  // Deterministic, order-independent pick: sorting by id first means the
  // choice does not depend on the order pack files happen to be imported.
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  const seed = `${input.seed ?? ""}|${input.industry ?? ""}|${input.country ?? ""}|${input.positionCount}`;
  const dna = sorted[stableHash(seed) % sorted.length];

  const reason = input.printOrNewspaper
    ? `Print or newspaper destination — ${dna.label} sets a classified that a paper will accept.`
    : wantsDtp
      ? `${input.positionCount} positions — ${dna.label} carries them in a ruled table without dropping one.`
      : `${input.positionCount} position${input.positionCount === 1 ? "" : "s"} — ${dna.label} gives each role full weight.`;

  return { dna, reason, fromOverride: false };
}

/** FNV-1a. Stable across processes and Node versions, unlike hashing objects. */
export function stableHash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
