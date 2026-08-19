import type { PositionSourceRecord } from "@/server/generation/pipeline/content-intelligence";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

/**
 * Transcribed verbatim from the real source requirement circulated by
 * SRACO HR / handled by Al Yousuf Enterprises LLP's recruitment team:
 * "Fireproofing Mason/ Cable Try Technician - Category & JD" followed by
 * "Manpower Requirement for Waterproofing Div." — 9 positions / 45
 * vacancies across two document tables.
 *
 * Not corrected: "Cable Try Technician" is the source's own spelling
 * (the duties describe cable TRAY installation, but "try" is an
 * ordinary English word with a plausible-enough reading that the
 * existing display-title normalisation policy — src/lib/display-title.ts
 * — deliberately does not touch it; see that module's own documented
 * boundary). Left exactly as written.
 *
 * `sourceDivision` is populated ONLY for the six roles under the
 * document's own "Manpower Requirement for Waterproofing Div." heading
 * — an explicit, verified grouping label the source itself states. The
 * first table (Fireproofing Mason / Cable Try Technician / Sheet Metal
 * Fabricator) carries no equivalent explicit division label in the
 * source, so none is invented for it; those three still classify
 * correctly by title keyword alone (fireproof / cable tray / sheet
 * metal / fabricat).
 *
 * `technicalDuties` carries the functional skill/JD text verbatim.
 * `qualification` is left undefined throughout: no role in this
 * requirement states a formal educational qualification anywhere in
 * the source. `experience` is left undefined for the 7 roles that state
 * no years figure — never invented.
 *
 * `salary` is the Basic Salary range ONLY, exactly as the source states
 * it per row. It lives only on the AdvertisementFacts-shaped rows below
 * (PositionSourceRecord, the Content Intelligence input, has no salary
 * field — salary is deliberately never routed through that
 * classification/compression pipeline; see compressSalaryPresentation's
 * own contract). The common tail (SAR 250 food allowance;
 * transport/accommodation/medical provided; 8 hrs/day, 6 days/week, OT
 * eligible) is identical across all 9 rows in the source and is
 * represented once at the campaign level below, not repeated per
 * position.
 */
interface SourceRow {
  title: string;
  count: number;
  experience?: string;
  technicalDuties: string;
  salary: string;
  sourceDivision?: string;
  sourceRowIndex: number;
}

const WATERPROOFING_DIV = "Manpower Requirement for Waterproofing Div.";

const ROWS: SourceRow[] = [
  {
    title: "Fireproofing Mason",
    count: 10,
    experience: "2 to 3 years",
    technicalDuties:
      "Apply fireproofing materials such as cementitious fireproofing, vermiculite, perlite, mortar, and other approved materials. Perform masonry, plastering, rendering, and concrete repair works related to fireproofing. Install and fix reinforcement mesh, anchors, pins, and other supporting systems.",
    salary: "SAR 1300 to SAR 1600 SAR",
    sourceRowIndex: 1,
  },
  {
    title: "Cable Try Technician",
    count: 10,
    technicalDuties:
      "Install and assemble various types of cable trays, ladders, trunking, and cable support systems. Install cable tray supports, brackets, hangers, threaded rods, and structural supports.",
    salary: "SAR 1300 to SAR 1600 SAR",
    sourceRowIndex: 2,
  },
  {
    title: "Sheet Metal Fabricator",
    count: 5,
    experience: "4 to 5 years",
    technicalDuties: "Pipes and Equipment's Cladding sheet metal fabrication.",
    salary: "SAR 1500 to SAR 2200 SAR",
    sourceRowIndex: 3,
  },
  {
    title: "Bituminous / PVC / EPDM membrane waterproofing technicians",
    count: 6,
    technicalDuties: "Knowledge of installation of one or more type of membranes mentioned.",
    salary: "SAR 1300 to SAR 1500 SAR",
    sourceDivision: WATERPROOFING_DIV,
    sourceRowIndex: 4,
  },
  {
    title: "Epoxy flooring & coating technicians",
    count: 4,
    technicalDuties:
      "Knowledge of installation of Epoxy coatings & Self-levelling epoxies on floors & knowledge of Epoxy coatings Internal coating for Concrete Water tanks.",
    salary: "SAR 1300 to SAR 1500 SAR",
    sourceDivision: WATERPROOFING_DIV,
    sourceRowIndex: 5,
  },
  {
    title: "Spray Painters technicians for Spray applied waterproofing like acrylics, etc.",
    count: 4,
    technicalDuties: "Knowledge of spraying coatings with spray machines, the usual spray painting jobs.",
    salary: "SAR 1400 to SAR 1600 SAR",
    sourceDivision: WATERPROOFING_DIV,
    sourceRowIndex: 6,
  },
  {
    title: "Foam concrete (Light weight cellular concrete) masons",
    count: 2,
    technicalDuties: "Knowledge of casting slope guide levels & installation of foam concrete to slope on roofs.",
    salary: "SAR 1300 to SAR 1500 SAR",
    sourceDivision: WATERPROOFING_DIV,
    sourceRowIndex: 7,
  },
  {
    title: "Spray Polyurethane foam/ Polyurea spray technicians",
    count: 2,
    technicalDuties:
      "Knowledge of spraying Polyurethane foam or Polyureas coatings from the Polyurethane/Polyurea machines.",
    salary: "SAR 1400 to SAR 1800 SAR",
    sourceDivision: WATERPROOFING_DIV,
    sourceRowIndex: 8,
  },
  {
    title: "Spray foam machine/ rig operator",
    count: 2,
    technicalDuties:
      "Knowledge of operating & basic maintenance of Polyurethane/Polyurea machine including cleaning of Spray guns.",
    salary: "SAR 1600 to SAR 1900 SAR",
    sourceDivision: WATERPROOFING_DIV,
    sourceRowIndex: 9,
  },
];

/** Content Intelligence input — everything EXCEPT salary (see module doc). */
export const FIREPROOFING_WATERPROOFING: PositionSourceRecord[] = ROWS.map((r) => ({
  title: r.title,
  count: r.count,
  experience: r.experience,
  technicalDuties: r.technicalDuties,
  sourceDivision: r.sourceDivision,
  sourceRowIndex: r.sourceRowIndex,
}));

/** Full AdvertisementFacts["positions"] rows, salary included. */
export const FIREPROOFING_WATERPROOFING_FACTS_POSITIONS: AdvertisementFacts["positions"] = ROWS.map((r) => ({
  title: r.title,
  count: r.count,
  experience: r.experience,
  salary: r.salary,
  technicalDuties: r.technicalDuties,
  sourceDivision: r.sourceDivision,
}));

export const FIREPROOFING_WATERPROOFING_TOTAL_VACANCIES = 45;
export const FIREPROOFING_WATERPROOFING_TOTAL_POSITIONS = 9;

/** The common tail identical across every row in the source. */
export const FIREPROOFING_WATERPROOFING_COMMON_BENEFITS: AdvertisementFacts["benefits"] = [
  { label: "Food Allowance", detail: "SAR 250" },
  { label: "Transportation" },
  { label: "Accommodation" },
  { label: "Medical" },
];
export const FIREPROOFING_WATERPROOFING_DUTY_HOURS = "8 hrs/day · 6 days/week · OT eligible";
