/**
 * Campaign Intelligence — the communication strategy tables.
 *
 *   ... -> Compliance Intelligence -> **Campaign Intelligence** -> ...
 *
 * DATA, NOT CODE. Every communication decision is a lookup in a table
 * below, keyed on what JobOrder Intelligence and Compliance Intelligence
 * already determined. Teaching the engine a new campaign shape is a new
 * row, never a new branch.
 *
 * THE LINE THIS ENGINE MUST NOT CROSS
 *
 * It decides WHAT to communicate and to WHOM. It never decides how the
 * result looks: no layout, no typography, no colour, no position, no
 * rendering. The three image-related outputs describe SUBJECT MATTER
 * only — what the picture should be of — because that is a
 * communication decision. The moment a value here described composition,
 * palette or placement it would belong to Layout Intelligence, which
 * runs later.
 */

/** Which plant status implies which campaign story. */
export const PLANT_STATUS_STRATEGY: Record<
  string,
  {
    primaryMessage: string;
    candidateMotivation: string;
    urgencyStrategy: string;
    imageContext: string;
    rationale: string;
  }
> = {
  "Running Plant": {
    primaryMessage: "Long-term running plant maintenance",
    candidateMotivation: "Career Stability",
    urgencyStrategy: "Steady-state — sustained hiring, no artificial deadline",
    imageContext: "an operating plant during routine maintenance",
    rationale:
      "A running plant is an ongoing operation. The candidate is choosing a posting they may hold for years, so stability is the offer and manufactured urgency would ring false.",
  },
  Shutdown: {
    primaryMessage: "Fixed-duration shutdown campaign",
    candidateMotivation: "Short-term concentrated earning",
    urgencyStrategy: "Deadline-driven — the shutdown window is fixed and cannot slip",
    imageContext: "a plant under shutdown with intensive maintenance activity",
    rationale:
      "A shutdown has a date the plant cannot move. Candidates self-select for intensity and earnings over duration, and the deadline is real rather than a pressure tactic.",
  },
  Turnaround: {
    primaryMessage: "Planned turnaround mobilization",
    candidateMotivation: "Short-term concentrated earning",
    urgencyStrategy: "Deadline-driven — the turnaround window is fixed and cannot slip",
    imageContext: "a plant undergoing a planned turnaround",
    rationale:
      "Same commercial shape as a shutdown: a fixed window, high intensity, and a defined end date the candidate is choosing deliberately.",
  },
  Commissioning: {
    primaryMessage: "New plant commissioning",
    candidateMotivation: "New project experience",
    urgencyStrategy: "Milestone-driven — hiring tracks the commissioning schedule",
    imageContext: "a newly completed plant being brought into service",
    rationale:
      "Commissioning work is a career marker. Candidates take it for the experience and the reference, which is what the campaign should lead with.",
  },
  "Pre-Commissioning": {
    primaryMessage: "Pre-commissioning and systems completion",
    candidateMotivation: "New project experience",
    urgencyStrategy: "Milestone-driven — hiring tracks the completion schedule",
    imageContext: "a plant in systems completion before start-up",
    rationale:
      "Pre-commissioning attracts the same candidate as commissioning, for the same reason: it is specialist experience that is hard to obtain.",
  },
  Construction: {
    primaryMessage: "Project construction mobilization",
    candidateMotivation: "Sustained project duration",
    urgencyStrategy: "Phase-driven — hiring follows the construction programme",
    imageContext: "an active construction site",
    rationale:
      "Construction offers a known multi-year horizon, which is the reassurance a candidate leaving home is actually buying.",
  },
};

/** Which hiring shape implies which objective, audience and call to action. */
export const HIRING_PATTERN_STRATEGY: Record<
  string,
  { objective: string; ctaStrategy: string; visualFocus: string; rationale: string }
> = {
  "Bulk Mobilization": {
    objective: "Volume mobilization — fill a large multi-trade requirement quickly",
    ctaStrategy: "Open trade-test or walk-in call, with a stated venue and date",
    visualFocus: "A working crew, showing scale of the operation",
    rationale:
      "At this volume the constraint is throughput. The campaign must bring many candidates to one assessable place rather than start individual conversations.",
  },
  "Specialist Hiring": {
    objective: "Targeted acquisition of a scarce skill",
    ctaStrategy: "Direct application to a named contact, with the certification stated up front",
    visualFocus: "An individual professional at technical work",
    rationale:
      "A qualified pool this small is not reached by volume advertising. The campaign speaks to a small number of people who must recognise themselves in it immediately.",
  },
  "Management Hiring": {
    objective: "Senior appointment",
    ctaStrategy: "Confidential application to a named contact",
    visualFocus: "A professional setting rather than a work face",
    rationale:
      "Management candidates are usually employed and will not respond to an open call. Discretion is the precondition of any response at all.",
  },
  "Team Hiring": {
    objective: "Build a defined team for a known scope",
    ctaStrategy: "Application with trade and experience stated, ahead of a scheduled interview",
    visualFocus: "A small team at task",
    rationale:
      "A team-sized hire needs enough candidates to select from without the machinery of a bulk drive.",
  },
};

/** Which trade families imply which audience and tone. */
export const AUDIENCE_STRATEGY: {
  audience: string;
  tone: string;
  categories: string[];
  rationale: string;
}[] = [
  {
    audience: "Licensed healthcare professionals",
    tone: "Formal and precise",
    categories: ["Healthcare"],
    rationale:
      "Healthcare candidates read for licensing terms before anything else, and a loose claim about registration costs the agency the candidate.",
  },
  {
    audience: "Supervisory and management professionals",
    tone: "Formal and discreet",
    categories: ["Supervision & Management"],
    rationale:
      "Supervisory candidates assess the employer as much as the role, and respond to restraint rather than volume.",
  },
  {
    audience: "Certified technical specialists",
    tone: "Technical and precise",
    categories: ["Instrumentation", "QA/QC", "Operations", "HSE"],
    rationale:
      "These candidates identify by certification. Precise trade and ticket language is how they recognise a role as theirs.",
  },
  {
    audience: "Skilled trades workforce",
    tone: "Direct and concrete",
    categories: [
      "Welding & Fabrication", "Electrical", "Mechanical", "Piping", "HVAC",
      "Rigging & Lifting", "Insulation", "Painting & Blasting", "Scaffolding", "Civil",
    ],
    rationale:
      "Skilled trades read for trade, pay and duration. Plain concrete language outperforms anything decorative.",
  },
  {
    audience: "General workforce",
    tone: "Plain and direct",
    categories: ["General Labour", "Hospitality", "Driving & Logistics"],
    rationale:
      "This audience is the widest and the least likely to read past the first line, so the offer has to be immediately legible.",
  },
];

/** Which scarcity tier implies which secondary angle. */
export const SCARCITY_STRATEGY: Record<string, { secondaryMessage: string; rationale: string }> = {
  "Very Scarce": {
    secondaryMessage: "Certification-led — the ticket is the qualifier",
    rationale:
      "When the qualified pool is this small, naming the certification does more filtering work than any other line in the campaign.",
  },
  Scarce: {
    secondaryMessage: "Experience-led — stated experience band is the qualifier",
    rationale:
      "A scarce trade is found by making the experience requirement unambiguous, so the few who match self-identify.",
  },
  Moderate: {
    secondaryMessage: "Terms-led — stated salary and duration are the qualifier",
    rationale:
      "For a trade with real supply, the offer terms are what distinguish this campaign from the others the candidate is reading.",
  },
  Abundant: {
    secondaryMessage: "Access-led — how and where to apply is the qualifier",
    rationale:
      "With ample supply the constraint is reach and ease of response, not persuasion.",
  },
};

/**
 * Information priority by audience.
 *
 * The ORDER in which facts should be communicated. This is an editorial
 * decision, not a layout one: it says what matters most to this reader,
 * not where anything is placed on a page.
 */
export const INFORMATION_PRIORITY: Record<string, string[]> = {
  "Licensed healthcare professionals": ["Role and licensing requirement", "Employer and destination", "Salary and benefits", "Interview details", "How to apply"],
  "Supervisory and management professionals": ["Role and scope", "Employer and project", "Destination", "How to apply"],
  "Certified technical specialists": ["Trade and certification", "Salary", "Employer and project", "Interview details", "How to apply"],
  "Skilled trades workforce": ["Trade and headcount", "Salary", "Destination", "Interview details", "How to apply"],
  "General workforce": ["Trade and headcount", "Destination", "Interview details", "How to apply"],
};

/** Trust posture, driven by what Compliance Intelligence determined. */
export const TRUST_STRATEGY = {
  BLOCKED: {
    value: "Do not communicate — compliance is unresolved",
    rationale:
      "A campaign built on a requirement with a live compliance violation publishes the violation. Nothing goes out until it is cleared.",
  },
  UNVERIFIED: {
    value: "Licence disclosure only — no verification mark",
    rationale:
      "The registration number can be stated because it is on file, but the verification mark must not appear until verification is current. A mark on an unverified agency launders exactly the risk it signals.",
  },
  VERIFIED: {
    value: "Verified credentials foremost — licence number and verification mark",
    rationale:
      "Verification is the agency's strongest differentiator against the unlicensed operators the candidate is also reading, and it is independently checkable.",
  },
} as const;
