import type { PositionSourceRecord } from "@/server/generation/pipeline/content-intelligence";

/**
 * SYNTHETIC STRESS FIXTURE — 19 positions summing to 127 vacancies.
 *
 * CORRECTION: this file previously described itself as "transcribed
 * verbatim from the real source, Manpower_Vacant_Position2.pdf". That
 * was wrong. Checked against the actual PDF, NONE of the titles below
 * (Piping Engineer, Contracts Engineer, Welder, Rigger, Scaffolder,
 * Mechanical Fitter, Plumber, …) appear in it; the real requirement
 * lists Operation Manager, WPR, Time Keeper/HR Executive, Purchaser,
 * Tile Mason, IT Adminstator, HVAC Technician, DDC Technician, HSE
 * Manager and so on. Only the shape (19 roles / 127 vacancies) matched.
 *
 * It remains useful and is left unchanged as a DENSITY stress case —
 * many tests assert against these exact titles — but it must never
 * again be cited as real-source evidence. For that, use
 * `manpower-vacant-position-real.ts`, which is transcribed from the
 * actual PDF and carries the same 19/127 totals.
 */
export const MANPOWER_VACANT_POSITION_2: PositionSourceRecord[] = [
  { title: "Project Manager", count: 1, experience: "15+ years", qualification: "Bachelor's degree in Engineering", sourceRowIndex: 1 },
  { title: "Piping Engineer", count: 25, experience: "8 to 10 years", qualification: "Diploma in Mechanical Engineering", sourceRowIndex: 2 },
  { title: "Procurement Engineer", count: 2, experience: "10 years", qualification: "Bachelor's degree in Engineering", sourceRowIndex: 3 },
  { title: "Contracts Engineer", count: 2, experience: "10 years", qualification: "Bachelor's degree in Engineering", sourceRowIndex: 4 },
  { title: "Planning Engineer", count: 2, experience: "8 to 10 years", qualification: "Bachelor's degree in Engineering", sourceRowIndex: 5 },
  { title: "Project Controls Manager", count: 1, experience: "15 years", qualification: "Bachelor's degree in Engineering", sourceRowIndex: 6 },
  {
    title: "PQCS Engineer",
    count: 1,
    experience: "10 years",
    qualification: "Bachelor's degree in Engineering",
    remarks:
      "Candidate familiar with NMR 601,602,603 etc. Candidate hold Saudi Aramco approval is preferred but not mandatory.",
    sourceRowIndex: 7,
  },
  { title: "HVAC Engineer", count: 2, experience: "8 to 10 years", qualification: "Diploma in Mechanical Engineering", sourceRowIndex: 8 },
  { title: "HVAC Supervisor", count: 1, experience: "8 years", qualification: "Diploma in Mechanical Engineering", sourceRowIndex: 9 },
  { title: "HVAC Technician", count: 10, experience: "5 to 8 years", qualification: "ITI / Diploma in Mechanical Engineering", certifications: ["NMR 601"], sourceRowIndex: 10 },
  { title: "Electrical Engineer", count: 2, experience: "8 to 10 years", qualification: "Bachelor's degree in Electrical Engineering", sourceRowIndex: 11 },
  { title: "Instrument Engineer", count: 1, experience: "8 years", qualification: "Bachelor's degree in Instrumentation", sourceRowIndex: 12 },
  { title: "Electrician", count: 45, experience: "5 to 8 years", qualification: "ITI / Diploma in Electrical Engineering", sourceRowIndex: 13 },
  { title: "Welder", count: 7, experience: "5 to 8 years", qualification: "ITI / Trade Certificate", certifications: ["NMR 602"], sourceRowIndex: 14 },
  { title: "Pipefitter", count: 5, experience: "5 to 8 years", qualification: "ITI / Trade Certificate", certifications: ["NMR 603"], sourceRowIndex: 15 },
  { title: "Rigger", count: 5, experience: "5 to 8 years", qualification: "Trade Certificate", sourceRowIndex: 16 },
  { title: "Scaffolder", count: 5, experience: "5 to 8 years", qualification: "Trade Certificate", sourceRowIndex: 17 },
  { title: "Mechanical Fitter", count: 5, experience: "5 to 8 years", qualification: "ITI / Trade Certificate", sourceRowIndex: 18 },
  { title: "Plumber", count: 5, experience: "5 to 8 years", qualification: "ITI / Trade Certificate", sourceRowIndex: 19 },
];

export const MANPOWER_VACANT_POSITION_2_TOTAL_VACANCIES = 127;
export const MANPOWER_VACANT_POSITION_2_TOTAL_POSITIONS = 19;
