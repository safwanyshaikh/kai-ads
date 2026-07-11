import type { z } from "zod";
import type { positionSchema } from "@/lib/validations/advertisement";

type Position = z.infer<typeof positionSchema>;

/**
 * Advertisement Density Intelligence (Sprint 004).
 *
 * "1 critical position: LOW. 5 positions: MEDIUM. 20-30 positions: HIGH."
 * The brief gives anchor points, not a rigid formula — this uses total
 * headcount (sum of each position's `count`, not just the number of
 * distinct position titles) as the primary signal, since a "5 positions,
 * 200 total openings" requirement reads and lays out very differently
 * from "5 positions, 5 total openings" despite having the same position
 * count. Position variety is a secondary signal: many distinct titles
 * pushes density up even at low headcount, because a multi-trade
 * requirement needs more layout space than a single-trade one.
 */
export type DensityLevel = "LOW" | "MEDIUM" | "HIGH";

const LOW_MAX_HEADCOUNT = 3;
const MEDIUM_MAX_HEADCOUNT = 15;
const LOW_MAX_DISTINCT_POSITIONS = 1;
const MEDIUM_MAX_DISTINCT_POSITIONS = 6;

export function classifyDensity(positions: Position[]): DensityLevel {
  const distinctPositions = positions.length;
  const totalHeadcount = positions.reduce((sum, p) => sum + (p.count ?? 1), 0);

  if (
    totalHeadcount <= LOW_MAX_HEADCOUNT &&
    distinctPositions <= LOW_MAX_DISTINCT_POSITIONS
  ) {
    return "LOW";
  }

  if (
    totalHeadcount <= MEDIUM_MAX_HEADCOUNT &&
    distinctPositions <= MEDIUM_MAX_DISTINCT_POSITIONS
  ) {
    return "MEDIUM";
  }

  return "HIGH";
}
