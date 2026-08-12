import type { DesignDNA } from "../design-dna";
import { ASSIGNMENT_ABROAD_DTP } from "./assignment-abroad-dtp";
import { CONSTRUCTION } from "./construction";
import { CORPORATE_PREMIUM } from "./corporate-premium";
import { OIL_AND_GAS } from "./oil-and-gas";
import { PREMIUM_SOCIAL } from "./premium-social";

/**
 * The production DNA library: 50 designs across five packs.
 *
 * Quality over quantity was the instruction and it is the reason the count
 * stops here. Every entry is validated by the registry at module load and
 * every entry is reachable by selection — a DNA nothing can ever choose is
 * dead weight, not range.
 */
export const ALL_DNAS: DesignDNA[] = [
  ...PREMIUM_SOCIAL,
  ...ASSIGNMENT_ABROAD_DTP,
  ...CORPORATE_PREMIUM,
  ...CONSTRUCTION,
  ...OIL_AND_GAS,
];

export { PREMIUM_SOCIAL, ASSIGNMENT_ABROAD_DTP, CORPORATE_PREMIUM, CONSTRUCTION, OIL_AND_GAS };
