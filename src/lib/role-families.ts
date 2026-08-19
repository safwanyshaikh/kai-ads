/**
 * ROLE FAMILIES — the single source of truth for how a recruitment
 * position is clustered into a trade family.
 *
 * This lives in src/lib because BOTH the Content Intelligence stage and
 * the renderer classify positions, and `content-intelligence.ts`
 * already imports from `fact-layer.ts` — so the rules cannot live in
 * either without creating a cycle or a second copy that will drift the
 * next time a rule changes (Final Production Lock §23: only one
 * implementation may be active).
 *
 * The six families are the ones visible in both real reference
 * advertisements. Classification is deterministic keyword matching, not
 * a model call: the same requirement must always group the same way,
 * and a wrong cluster must be debuggable rather than opaque — which is
 * why every match also reports the rule that produced it.
 */
export interface RoleFamilyRule {
  id: string;
  /** Title case, for data/audit surfaces. */
  label: string;
  /** Upper case, for the rendered family heading. */
  heading: string;
  test: RegExp;
}

export const ROLE_FAMILY_RULES: readonly RoleFamilyRule[] = [
  {
    id: "project-management",
    label: "Project & Management",
    heading: "PROJECT & MANAGEMENT",
    test: /\b(manager|director|project\s*(lead|manager)|superintend)/i,
  },
  {
    id: "procurement-commercial",
    label: "Procurement & Commercial",
    heading: "PROCUREMENT & COMMERCIAL",
    test: /\b(procure|purchas|commercial|contract|buyer|cost\s*control)/i,
  },
  {
    id: "planning-controls",
    label: "Planning & Project Controls",
    heading: "PLANNING & PROJECT CONTROLS",
    test: /\b(planner|planning|scheduler|project\s*control|estimat)/i,
  },
  {
    id: "hvac-mechanical",
    label: "HVAC & Mechanical",
    heading: "HVAC & MECHANICAL",
    test: /\b(hvac|mechanic|fitter|welder|pipefitter|rigger|plumb)/i,
  },
  {
    id: "electrical-it",
    label: "Electrical & IT",
    heading: "ELECTRICAL & IT",
    test: /\b(electric|instrument|control\s*system|it\b|network|automation)/i,
  },
  {
    id: "fireproofing-fabrication",
    label: "Fireproofing & Fabrication",
    heading: "FIREPROOFING & FABRICATION",
    test: /\b(fireproof|cable\s*tray|cable\s*try|sheet\s*metal|fabricat|cladding)/i,
  },
  {
    id: "waterproofing-coatings",
    label: "Waterproofing Specialists",
    heading: "WATERPROOFING SPECIALISTS",
    test: /\b(waterproof|membrane|epoxy|spray|foam\s*concrete|polyurethane|polyurea|rig\s*operator)/i,
  },
] as const;

export const GENERAL_TRADES: RoleFamilyRule = {
  id: "general-trades",
  label: "General Trades",
  heading: "GENERAL TRADES",
  // Never matched directly — the catch-all when no functional rule fits.
  test: /(?!)/,
};

export interface RoleFamilyMatch {
  id: string;
  label: string;
  heading: string;
  /** Which rule placed this position — recorded so a wrong cluster is auditable. */
  basis: string;
}

/**
 * Classify one position into exactly one family.
 *
 * `sourceDivision` is an OPTIONAL verified grouping signal carried from
 * the source document itself (e.g. a table heading like "Manpower
 * Requirement for Waterproofing Div."), when the requirement provides
 * one. It is matched against the SAME rules as the title, never a
 * second classifier — a title-only match ("Spray Foam Machine/Rig
 * Operator" has no obvious trade keyword on its own) is strengthened by
 * a genuine source-provided division, without ever inventing one when
 * the source did not supply it.
 */
export function classifyRoleFamily(title: string, sourceDivision?: string | null): RoleFamilyMatch {
  const subject = sourceDivision ? `${sourceDivision} ${title}` : title;
  for (const rule of ROLE_FAMILY_RULES) {
    if (rule.test.test(subject)) {
      const matchedDivision = sourceDivision && !rule.test.test(title) && rule.test.test(sourceDivision);
      return {
        id: rule.id,
        label: rule.label,
        heading: rule.heading,
        basis: matchedDivision
          ? `source-provided division "${sourceDivision}" matched /${rule.test.source}/i`
          : `functional keyword match on title against /${rule.test.source}/i`,
      };
    }
  }
  return {
    id: GENERAL_TRADES.id,
    label: GENERAL_TRADES.label,
    heading: GENERAL_TRADES.heading,
    basis: "no functional keyword matched — General Trades catch-all",
  };
}
