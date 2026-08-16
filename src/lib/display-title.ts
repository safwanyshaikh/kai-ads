/**
 * Display-only spelling normalisation for obvious source/OCR defects.
 *
 * The stored recruitment fact remains authoritative and untouched — this
 * corrects only what is TYPESET, and only for tokens that are not English
 * words at all and have exactly one plausible reading in a job title
 * ("Adminstator" -> "Administrator"). Anything genuinely ambiguous, and
 * any word that exists in ordinary English (e.g. "manger"), is left
 * exactly as the source wrote it: publishing an agency's own wording
 * unchanged is safer than guessing at a role it may really have meant.
 *
 * This lives in lib/ rather than inside the generation pipeline because
 * BOTH renderings of a requirement must agree: the server-side fact layer
 * that typesets the final PNG, and the in-app advertisement canvas the
 * recruiter reviews. When only the pipeline normalised, the recruiter saw
 * "IT Adminstator" on screen and Visual QA reported the same typo against
 * the generated image.
 */
const TITLE_SPELLING_FIXES: Record<string, string> = {
  adminstator: "Administrator",
  administator: "Administrator",
  adminstrator: "Administrator",
  qualality: "Quality",
  quallity: "Quality",
  qualiity: "Quality",
  enginer: "Engineer",
  engneer: "Engineer",
  enginner: "Engineer",
  techncian: "Technician",
  techinician: "Technician",
  technican: "Technician",
  mechnical: "Mechanical",
  electrican: "Electrician",
  supervisar: "Supervisor",
  carpender: "Carpenter",
};

/**
 * The role title as it should be TYPESET — never as it is stored. Applied
 * at every draw and at every measurement, so a planner and a renderer can
 * never disagree about how wide a title is.
 */
export function displayTitle(title: string): string {
  // Every maximal run of letters is considered on its own, so punctuation,
  // spacing and compound forms survive untouched — "Adminstator/HR" and
  // "Time Keeper/HR Executive" both keep their structure, and only a word
  // that is itself a known defect is replaced.
  return title.replace(/[A-Za-z]+/g, (word) => TITLE_SPELLING_FIXES[word.toLowerCase()] ?? word);
}
