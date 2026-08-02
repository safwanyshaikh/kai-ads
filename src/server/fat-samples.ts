/**
 * Founder Sample Pack (Task 006.5 requirement 7).
 *
 * One click loads one of these into the validation page — no product
 * feature, just fixtures so the Founder can see a first result before
 * finding their own real requirements. Every sample below is exactly the
 * kind of message this platform's own tests already exercise (see
 * tests/requirement-source-intake.test.ts and
 * tests/requirement-intelligence.test.ts), reused here rather than
 * invented fresh.
 *
 * File-based samples (Screenshot, Excel) can't be embedded as text, so
 * those two entries carry instructions instead of a body — the "One
 * click to load" expectation is met for the five text/URL-based
 * channels; the two file channels get a clear note telling the Founder
 * exactly what to upload instead.
 */

export interface FatSample {
  kind: string;
  label: string;
  /** Present for text-based samples — loads directly into the paste box. */
  text?: string;
  /** Present for file-based samples that need a real upload — shown as guidance instead of a body. */
  note?: string;
}

export const FAT_SAMPLES: FatSample[] = [
  {
    kind: "WHATSAPP_TEXT",
    label: "WhatsApp — Shutdown requirement",
    text:
      "URGENT REQUIREMENT\n" +
      "Client: ABC Contracting, Jubail Refinery Shutdown\n" +
      "Need 18 Instrument Technicians, 6 Analyzer Technicians, 12 Process Operators\n" +
      "Salary SAR 3200 (Instrument), SAR 2800 (others)\n" +
      "5+ years experience, CSWIP 3.1 preferred for Instrument\n" +
      "Interview 14th August 2026, Mumbai\n" +
      "Immediate joining required",
  },
  {
    kind: "PDF",
    label: "PDF — Demand letter",
    note:
      "Upload a real PDF demand letter from your own recruitment work. There is no safe way to embed a sample PDF's bytes here — use any recent demand letter you have on hand; the engine reads its text exactly as sent.",
  },
  {
    kind: "IMAGE",
    label: "Screenshot — WhatsApp forward",
    note:
      "Upload a real WhatsApp screenshot of a requirement someone forwarded you. The engine reads it via vision/OCR — text quality varies with screenshot clarity, which is exactly what this test should reveal.",
  },
  {
    kind: "EXCEL",
    label: "Excel — Demand workbook",
    note:
      "Upload a real Excel demand sheet. Every sheet in the workbook is read, not just the first — if your file has trades on one tab and a pay scale on another, both should appear in the result.",
  },
  {
    kind: "GOOGLE_SHEET",
    label: "Google Sheet — link-shared demand tracker",
    note:
      "Paste the link to a Google Sheet you've shared as \"Anyone with the link can view\". A private (unshared) sheet will fail with a clear message rather than silently returning nothing — that failure is itself a valid test result.",
  },
  {
    kind: "WEBSITE",
    label: "Website — public vacancy listing",
    note:
      "Paste the URL of any public job listing page. Navigation, scripts and styling are stripped before extraction; only the page's visible text reaches the engine.",
  },
];
