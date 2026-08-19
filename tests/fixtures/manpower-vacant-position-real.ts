import type { PositionSourceRecord } from "@/server/generation/pipeline/content-intelligence";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

/**
 * THE REAL SOURCE — transcribed directly from the uploaded
 * "Manpower Vacant Position" PDF (Saudi Arabia requirement circulated by
 * Al Yousuf Enterprises LLP): 19 roles across three pages.
 *
 * ── Why this file exists ────────────────────────────────────────────
 * `manpower-vacant-position-2.ts` claims in its own docstring to be
 * "transcribed verbatim" from this same PDF, but its titles (Piping
 * Engineer, Contracts Engineer, Welder, Rigger, Scaffolder, Mechanical
 * Fitter, Plumber, …) appear NOWHERE in it. That fixture is synthetic
 * data mislabelled as the real source; it is left untouched here
 * because many existing tests assert against it, but it must not be
 * cited as real-source evidence. The genuine PDF data also exists as
 * `SAUDI_19` inside tests/fact-layer.test.ts, and this fixture agrees
 * with that list exactly.
 *
 * ── Vacancy total ───────────────────────────────────────────────────
 * Page 1 = 47 (1+25+2+2+2+1+1+2+1+10), page 2 = 60 (2+1+45+7+5),
 * page 3 = 20 (5+5+5+5). TOTAL = 127 across 19 roles.
 *
 * The FINAL REAL-SOURCE ACCEPTANCE directive states 125, but its own
 * itemised page-1 list sums to 47 rather than the 45 subtotal it
 * records — an arithmetic slip, not a data disagreement: every
 * individual role/count in that directive matches this PDF exactly.
 * Reaching 125 would require altering a verified vacancy quantity,
 * which the Truth Brain rule forbids, so the source figure stands.
 *
 * ── Transcription notes ─────────────────────────────────────────────
 * Source spellings are preserved verbatim, including the PDF's own
 * defects ("IT Adminstator", "Qualality Manager"); display-only
 * normalisation happens downstream in src/lib/display-title.ts, never
 * in the stored fact.
 *
 * The Sr. No. column restarts twice (once mid-page-1 after Operation
 * Manager, once at the page-2 "Imporatant and need to start
 * Preparation" divider row). Those are layout artefacts and a priority
 * marker respectively — neither is a position, and the divider is NOT
 * used as a `sourceDivision` because it names a scheduling priority,
 * not a trade division, and would be a misuse of that field.
 *
 * Operation Manager states NO total-experience and NO Gulf-experience
 * figure in the source; both are left undefined rather than invented.
 * Several trade roles likewise state no Gulf experience at all.
 */
interface SourceRow {
  title: string;
  count: number;
  qualification?: string;
  experience?: string;
  /** The source's own "Saudi Aramco /Gulf Experience" column. */
  gulfExperience?: string;
  remarks?: string;
  sourceRowIndex: number;
}

const ROWS: SourceRow[] = [
  /* ── PAGE 1 ─────────────────────────────────────────────────────── */
  {
    title: "Operation Manager",
    count: 1,
    qualification: "Civil or Mechanical",
    remarks:
      "Candidate must handle Following; Process Improvement. Financial Oversight and Manage Cash In Flow and Cash Flow. Cross Dept Communication. Project Completion in Time (Plannning & Scheduling & Controlling). Will be responsible for Project Execution, Invoicing and Budget controlling.",
    sourceRowIndex: 1,
  },
  {
    title: "WPR",
    count: 25,
    qualification: "Civil Engineering",
    experience: "2 Years",
    // The source's Gulf column for this row reads exactly "Not Mandatory".
    gulfExperience: "Not Mandatory",
    sourceRowIndex: 2,
  },
  {
    title: "Time Keeper/ HR Executive",
    count: 2,
    qualification: "Graduate",
    experience: "4-5 Years",
    gulfExperience: "2-3 Years",
    remarks:
      "Experience in Handling 800 Manpower. Very Good in MS Excell, Powerpoint, Word. Familiar with ZenHR Software will be added value.",
    sourceRowIndex: 3,
  },
  {
    title: "Procurement Engineer -Estimation",
    count: 2,
    qualification: "Engineering ( Civil /Mechanical )",
    experience: "5-6 Years",
    gulfExperience: "2-3 Years",
    remarks:
      "Candidate will be working as Procurement Coordiantor to collect Quotation to be used for the Estimation / Bidding, Negotiate and finalize Vendor to issue PO after the project is awarded.",
    sourceRowIndex: 4,
  },
  {
    title: "Purchaser",
    count: 2,
    qualification: "Any Graduate",
    experience: "5-6 Years",
    gulfExperience: "2 Years",
    remarks:
      "Candiate must have experience in local purchase of Material for Saudi Aramco Civil projects.",
    sourceRowIndex: 5,
  },
  {
    title: "Planning Engineer Lead",
    count: 1,
    qualification: "Mechanical or Civil Engineer",
    experience: "7-8 Years",
    gulfExperience: "2 Years",
    remarks:
      "Experience in handling Maitenance Project planning, Scheduling & Controlling. Primavera P6 Certified & Experienced.",
    sourceRowIndex: 6,
  },
  {
    title: "Planning Engineer",
    count: 1,
    qualification: "Mechanical or Civil Engineer",
    experience: "5 Years",
    gulfExperience: "2 Years",
    remarks:
      "Experience in handling Maitenance Project planning, Scheduling & Controlling. Primavera P6 Certified & Experienced.",
    sourceRowIndex: 7,
  },
  {
    title: "Procurement Engineer Construction",
    count: 2,
    qualification: "Mechanical or Civil Engineer",
    experience: "5-6 Years",
    gulfExperience: "2 Years",
    remarks: "Must have experience in Saudi Aramco Project Material Procurement.",
    sourceRowIndex: 8,
  },
  {
    title: "Procurement Manager",
    count: 1,
    qualification: "Mechanical or Civil Engineer",
    experience: "10-12 Years",
    gulfExperience: "03-04 Years",
    remarks:
      "Candidate must have knowledge on Engineering Design review. Candidate must have administrative command. Candidate atleast 3 Years experience as Procurement Manager. Aramco project exposure is sufficient approval is not reuqired.",
    sourceRowIndex: 9,
  },
  {
    title: "Electrician",
    count: 10,
    qualification: "Diploma / Polytechnic",
    experience: "5 Years",
    remarks:
      "Candidate must have Oil & Gas. Good in Written & Verbal English. Hands on Experience on Low Current and Medium Voltage.",
    sourceRowIndex: 10,
  },

  /* ── PAGE 2 ─────────────────────────────────────────────────────── */
  {
    title: "Tile Mason",
    count: 2,
    qualification: "10th Pass",
    experience: "5 Years",
    remarks:
      "Candidate should have hands on experience Lay Out & Measuring. Surface Preparation. Cutting & Shaping. Installation. Grouting & Sealing.",
    sourceRowIndex: 11,
  },
  {
    title: "IT Adminstator",
    count: 1,
    qualification: "Any Graduate",
    experience: "10 Years",
    gulfExperience: "2 Years",
    remarks:
      "Candidate must have following hand on Experience Install Configure and update Hardware & Software. Monitor Network Performance & resolve Connection Issues. Set Up user profile, Manage Passwords, Controll access rights. Run Data Back up & perform disaster recovery tasks. Apply Security patches and enforce cyber Safety rules. Help Staff fix daily computer and printer issues. Controll and manage company server system. Knowledge & Certification of relevant course is a must.",
    sourceRowIndex: 12,
  },
  {
    title: "HVAC Technician",
    count: 45,
    qualification: "Diploma / Polytechnic",
    experience: "5 Years",
    remarks:
      "Candidate should have oil & Gas HVAC System Installation, Mainteance. Candidate should have good Verbal and Written English. Candidate know driving skills.",
    sourceRowIndex: 13,
  },
  {
    title: "DDC Technician ( HVAC)",
    count: 7,
    qualification: "Diploma Or Degree in Mechanical ( HVAC )",
    experience: "7 Years",
    gulfExperience: "2 Years",
    remarks:
      "Candidate should have oil & Gas HVAC System installs, programs, tests, and repairs computerized automation systems that manage commercial heating, ventilation, and air conditioning (HVAC) networks. Candidate should have good Verbal and Written English. Candidate know driving skills.",
    sourceRowIndex: 14,
  },
  {
    title: "Mechanical Engineer ( HVAC)",
    count: 5,
    qualification: "Degree in Mechanical ( HVAC )",
    experience: "10 Years",
    gulfExperience: "3 Years",
    remarks:
      "Candidate should have oil & Gas HVAC System Identification of Error, rectification recommendation, controlling team & timely delivery of maitenance of system to cleint. Candidate should have good Verbal and Written English. Candidate know driving skills.",
    sourceRowIndex: 15,
  },

  /* ── PAGE 3 ─────────────────────────────────────────────────────── */
  {
    title: "Project Manager",
    count: 5,
    qualification: "Engineering ( Civil /Mechanical )",
    experience: "15 Years",
    gulfExperience: "5 Years",
    remarks:
      "Familiar with LSTK project Execution. Hold following Certification & Degree PMP. MBA in Constrcution and Operation. Hand on Expereince for design review and LSTK Stage of Design process and completion.",
    sourceRowIndex: 16,
  },
  {
    title: "Qualality Manager",
    count: 5,
    qualification: "Engineering ( Civil /Mechanical )",
    experience: "15 Years",
    gulfExperience: "5 Years",
    remarks:
      "Familiar with LSTK project Execution. Hold following Certification & Degree PMP. MBA in Constrcution and Operation. ISO certification Lead Auditor Valid certifciate. Project Quality Plan - Preparation and approval. Project Engineering Plan Review. Project Procurement Plan Review. Project Execution plan review along with Reporting to Project Manager. Hand on Expereince for design review and LSTK Stage of Design process and completion.",
    sourceRowIndex: 17,
  },
  {
    title: "HSE Manager",
    count: 5,
    qualification: "Engineering ( Civil /Mechanical )/ or Any Other Graduation",
    experience: "15 Years",
    gulfExperience: "5 Years",
    remarks:
      "Familiar with LSTK Project execution. Hold Valid NeBosch Certifciation for Safety Management. Hold Valid Ccdertificate Train the trainer. JSA, HIP, Method of Statement preparation.",
    sourceRowIndex: 18,
  },
  {
    title: "PQCS",
    count: 5,
    qualification: "Engineering ( Civil /Mechanical )/ or Any Other Graduation",
    experience: "10 Years",
    gulfExperience: "5 Years",
    remarks:
      "Familiar with LSTK project Execution. Candidate is familiar with Procurement procedure, MTA, MR and PR. Candidate familiar with NMR 601,602,603 etc. Candidate hold Saudi Aramco approval is preferred but not mandatory.",
    sourceRowIndex: 19,
  },
];

/** Content Intelligence input — carries remarks for statement tagging. */
export const MANPOWER_REAL: PositionSourceRecord[] = ROWS.map((r) => ({
  title: r.title,
  count: r.count,
  qualification: r.qualification,
  experience: r.experience,
  gulfExperience: r.gulfExperience,
  remarks: r.remarks,
  sourceRowIndex: r.sourceRowIndex,
}));

/** AdvertisementFacts["positions"] rows. No salary: the source states none. */
export const MANPOWER_REAL_FACTS_POSITIONS: AdvertisementFacts["positions"] = ROWS.map((r) => ({
  title: r.title,
  count: r.count,
  qualification: r.qualification,
  experience: r.experience,
  gulfExperience: r.gulfExperience,
}));

export const MANPOWER_REAL_TOTAL_POSITIONS = 19;
export const MANPOWER_REAL_TOTAL_VACANCIES = 127;

/** Exact role/count set, for assertion against the source table. */
export const MANPOWER_REAL_EXPECTED: [string, number][] = ROWS.map((r) => [r.title, r.count]);
