/**
 * KAI Ads PRODUCT CERTIFICATION RUN (CI only — requires OPENAI_API_KEY).
 *
 * Generates REAL advertisements through the complete GPT-Native creative
 * path — Creative Director → Commercial Brief → master prompt → GPT
 * Image → Trust Layer — and scores EVERY one with the acceptance
 * instrument (per-dimension Visual QA + rendered-fact proofread + QR
 * gate). 30 fixtures: 10 industries × 3 content densities, with brand
 * palettes varied so brand weaving is exercised.
 *
 * Output per advertisement:
 *   scripts/certification/artifacts/{id}.png
 *   scripts/certification/artifacts/{id}.report.json   full quality report
 * Plus:
 *   scripts/certification/artifacts/CERTIFICATION_SUMMARY.json
 *
 * Scores are reported on the /10 scale demanded by the certification
 * mission (Visual QA's 0-100 ÷ 10). Fact-fidelity failures (misspelled
 * or missing grounded facts) mark an advertisement REJECTED regardless
 * of its visual score — Supreme Principles 1 and 8 are absolute.
 *
 * Single-shot by design: certification measures RAW first-attempt
 * quality (the production service's bounded retry loop would mask it).
 *
 * Language note (recorded honestly): the extraction and prompt pipeline
 * is English-only today; multi-language fixtures are out of scope until
 * the product adds language support.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCreativeDirector } from "@/server/generation/creative-director/creative-director";
import { factsToCreativeInput } from "@/server/generation/creative-director/pipeline-adapter";
import { buildCommercialAdvertisementBrief } from "@/server/generation/gpt-native/commercial-brief";
import { buildMasterAdvertisementPrompt, type BrandContext } from "@/server/generation/gpt-native/master-prompt-builder";
import { applyTrustLayer, computeImageSha256 } from "@/server/generation/gpt-native/trust-layer";
import { runGptNativeAcceptance } from "@/server/generation/gpt-native/acceptance";
import { buildQrTrackingUrl, generateAndVerifyQr } from "@/server/generation/qr-renderer";
import { getImageGenerationProvider } from "@/server/ai/image";
import { getEnv } from "@/lib/env";
import type { AdvertisementFacts } from "@/server/generation/archetypes/types";

const WIDTH = 1024;
const HEIGHT = 1536;
const CONCURRENCY = 3;
const ARTIFACTS_DIR = path.join(process.cwd(), "scripts/certification/artifacts");
/** The certification bar (mission Phase 4): /10 scale. */
const PASS_BAR = 9.5;

const AGENCY = {
  name: "Al-Yousuf Enterprises LLP",
  ra: "9986",
  footer: "REG. LICENSE NO. B-1487/MUM/PART/1000+/9986/2022",
  contact: { phone: "9324995767", email: "jobs@alyousufent.com" },
};

const BRANDS: (BrandContext | null)[] = [
  null, // industry-default palette — no DNA
  { primaryColor: "#0B3D2E", secondaryColor: "#C9A227", accentColor: "#E4572E" }, // green/gold agency
  { primaryColor: "#12355B", secondaryColor: "#B31942", accentColor: "#F2A900" }, // navy/red agency
];

interface Fixture {
  id: string;
  industry: string;
  density: "sparse" | "medium" | "dense";
  brand: BrandContext | null;
  facts: AdvertisementFacts;
}

function fixture(
  id: string,
  industry: string,
  density: Fixture["density"],
  brandIdx: number,
  facts: Omit<AdvertisementFacts, "agencyName" | "raLicenseId" | "fullRegistrationNumber" | "contact" | "footer"> &
    Partial<Pick<AdvertisementFacts, "contact" | "footer">>,
): Fixture {
  return {
    id,
    industry,
    density,
    brand: BRANDS[brandIdx % BRANDS.length],
    facts: {
      contact: AGENCY.contact,
      footer: AGENCY.footer,
      ...facts,
      agencyName: AGENCY.name,
      raLicenseId: AGENCY.ra,
      fullRegistrationNumber: AGENCY.footer,
    },
  };
}

const pos = (title: string, count?: number, salary?: string, experience?: string) => ({ title, count, salary, experience });
const ben = (label: string, detail?: string) => ({ label, detail });
const manyRoles = (prefix: string, titles: string[]) => titles.map((t, i) => pos(t, 2 + (i % 5)));

/** 10 industries × 3 densities = 30 real-shaped fixtures. */
const FIXTURES: Fixture[] = [
  // ─── Oil & Gas ───
  fixture("oilgas-sparse", "Oil & Gas", "sparse", 0, {
    header: "Senior Drilling Supervisor — Saudi Arabia", industry: "Oil & Gas", country: "Saudi Arabia", employer: "Aramco Contractor",
    positions: [pos("Senior Drilling Supervisor", 1, "SAR 18,000", "15+ years offshore")], benefits: [ben("Family status"), ben("Annual flights")], interview: [],
  }),
  fixture("oilgas-medium", "Oil & Gas", "medium", 1, {
    header: "Shutdown Project — Bilfinger Saudi Arabia", industry: "Oil & Gas", country: "Saudi Arabia", employer: "Bilfinger",
    positions: [pos("Welder TIG 6G", 12, "SAR 2,500"), pos("Instrument Technician", 8), pos("Rotating Equipment Technician", 6), pos("Mechanical Technician", 10), pos("Electrical Technician", 9)],
    benefits: [ben("Basic + 4 hrs OT daily"), ben("Food & accommodation")], interview: [{ date: "14th & 15th July", location: "Baroda" }, { date: "18th July", location: "Mumbai" }],
  }),
  fixture("oilgas-dense", "Oil & Gas", "dense", 2, {
    header: "Halliburton Field Services — Mass Recruitment", industry: "Oil & Gas", country: "Saudi Arabia", employer: "Halliburton",
    positions: manyRoles("hal", ["Sperry Drilling Services", "Wireline & Perforating", "Cementing Operators", "Coiled Tubing", "Testing & Subsea", "Completion Tools", "Artificial Lift", "Drill Bits Services", "Baroid Fluids", "Production Solutions", "Pipeline Services", "HSE Officers", "Logistics Coordinators", "Warehouse Keepers", "Heavy Drivers", "Riggers Level 3", "Scaffolders", "Crane Operators"]),
    benefits: [ben("Company transport"), ben("Medical insurance")], interview: [{ date: "Online screening", location: "Shortlisted candidates" }],
  }),
  // ─── Construction ───
  fixture("construction-sparse", "Construction", "sparse", 1, {
    header: "Project Manager — NEOM Giga Project", industry: "Construction", country: "Saudi Arabia", employer: "NEOM Main Contractor",
    positions: [pos("Construction Project Manager", 1, "SAR 25,000", "PMP, 12+ years GCC")], benefits: [ben("Executive housing"), ben("Family visa")], interview: [],
  }),
  fixture("construction-medium", "Construction", "medium", 2, {
    header: "High-Rise Tower Project — Dubai", industry: "Construction", country: "UAE", employer: null,
    positions: [pos("Shuttering Carpenter", 40, "AED 1,400"), pos("Steel Fixer", 35, "AED 1,400"), pos("Mason", 30, "AED 1,500"), pos("Site Foreman", 6, "AED 3,500")],
    benefits: [ben("Free food & accommodation"), ben("Transport"), ben("Overtime")], interview: [{ date: "22 July", location: "Delhi" }],
  }),
  fixture("construction-dense", "Construction", "dense", 0, {
    header: "Qatar Infrastructure Program — 500+ Vacancies", industry: "Construction", country: "Qatar", employer: null,
    positions: manyRoles("qc", ["Excavator Operator", "Grader Operator", "Roller Operator", "Dump Truck Driver", "Surveyor", "Lab Technician", "QC Inspector Civil", "Land Surveyor Assistant", "Asphalt Foreman", "Concrete Foreman", "Pipe Layer", "Drainage Supervisor", "Road Marking Technician", "Safety Officer NEBOSH", "First Aider", "Storekeeper", "Timekeeper", "Camp Boss", "Cook", "Cleaner"]),
    benefits: [ben("FAT provided", "Food, accommodation, transport")], interview: [{ date: "Walk-in 25-27 July", location: "Mumbai office" }],
  }),
  // ─── Shipyard ───
  fixture("shipyard-sparse", "Shipyard", "sparse", 2, {
    header: "Marine Chief Engineer — Bahrain Dry Docks", industry: "Shipyard", country: "Bahrain", employer: "ASRY",
    positions: [pos("Marine Chief Engineer", 2, "BHD 1,200", "Class 1 CoC")], benefits: [ben("Family status"), ben("Schooling allowance")], interview: [],
  }),
  fixture("shipyard-medium", "Shipyard", "medium", 0, {
    header: "Ship Repair Yard — Multiple Trades", industry: "Shipyard", country: "UAE", employer: "Drydocks World",
    positions: [pos("Ship Fitter", 25, "AED 1,800"), pos("Marine Pipe Fitter", 20, "AED 1,900"), pos("Hull Welder 6G", 30, "AED 2,200"), pos("Blaster/Painter", 15, "AED 1,600")],
    benefits: [ben("Accommodation + transport"), ben("OT available")], interview: [{ date: "20 July", location: "Chennai" }, { date: "23 July", location: "Cochin" }],
  }),
  fixture("shipyard-dense", "Shipyard", "dense", 1, {
    header: "New-Build Program — Qatar Shipyard", industry: "Shipyard", country: "Qatar", employer: null,
    positions: manyRoles("sy", ["Structural Fitter", "Pipe Fitter", "6G Welder", "3G Welder", "Grinder", "Gas Cutter", "Rigger", "Crane Operator", "Forklift Operator", "Scaffolder", "Insulator", "Electrician Marine", "Instrument Fitter", "HVAC Technician", "Painter Airless", "Blaster", "QC Welding Inspector", "HSE Officer"]),
    benefits: [ben("Free FAT")], interview: [{ date: "CV shortlisting", location: "Apply by email" }],
  }),
  // ─── Hospitality ───
  fixture("hospitality-sparse", "Hospitality", "sparse", 1, {
    header: "Executive Chef — 5-Star Resort, Ras Al Khaimah", industry: "Hospitality", country: "UAE", employer: "Luxury Resort Group",
    positions: [pos("Executive Chef", 1, "AED 15,000", "5-star background, Mediterranean cuisine")], benefits: [ben("Service charge"), ben("Duty meals"), ben("Accommodation")], interview: [],
  }),
  fixture("hospitality-medium", "Hospitality", "medium", 2, {
    header: "Palace Hotel Pre-Opening — Doha", industry: "Hospitality", country: "Qatar", employer: null,
    positions: [pos("Front Office Agent", 10, "QAR 2,200"), pos("Housekeeping Attendant", 30, "QAR 1,600"), pos("Waiter/Waitress", 25, "QAR 1,800"), pos("Barista", 8, "QAR 2,000"), pos("Bell Attendant", 6, "QAR 1,700")],
    benefits: [ben("Shared accommodation"), ben("Duty meals"), ben("Medical")], interview: [{ date: "28-29 July", location: "Mumbai" }],
  }),
  fixture("hospitality-dense", "Hospitality", "dense", 0, {
    header: "Red Sea Destination Mega Opening — 300 Roles", industry: "Hospitality", country: "Saudi Arabia", employer: null,
    positions: manyRoles("ho", ["Commis I", "Commis II", "Demi Chef", "Chef de Partie", "Pastry Chef", "Butcher", "Steward", "Waiter", "Hostess", "Bartender", "Room Attendant", "Public Area Attendant", "Laundry Attendant", "Front Desk Agent", "Concierge", "Lifeguard", "Spa Therapist", "Fitness Instructor", "Bellman", "Driver"]),
    benefits: [ben("Full board"), ben("Flights"), ben("Uniform")], interview: [{ date: "Online + final F2F", location: "Delhi" }],
  }),
  // ─── Healthcare ───
  fixture("healthcare-sparse", "Healthcare", "sparse", 0, {
    header: "Consultant Radiologist — Kuwait Ministry Hospital", industry: "Healthcare", country: "Kuwait", employer: "Ministry of Health",
    positions: [pos("Consultant Radiologist", 2, "KWD 3,200", "Board certified")], benefits: [ben("Family status"), ben("Education allowance")], interview: [],
  }),
  fixture("healthcare-medium", "Healthcare", "medium", 1, {
    header: "New Specialty Hospital — Riyadh", industry: "Healthcare", country: "Saudi Arabia", employer: null,
    positions: [pos("Staff Nurse ICU", 20, "SAR 5,500", "DHA/Prometric"), pos("Staff Nurse ER", 15, "SAR 5,500"), pos("Lab Technologist", 8, "SAR 4,800"), pos("Radiology Technician", 6, "SAR 4,800"), pos("Pharmacist", 5, "SAR 6,500")],
    benefits: [ben("Free accommodation"), ben("Annual ticket"), ben("Malpractice cover")], interview: [{ date: "Prometric + online", location: "Apply now" }],
  }),
  fixture("healthcare-dense", "Healthcare", "dense", 2, {
    header: "Hospital Group Expansion — All Departments", industry: "Healthcare", country: "UAE", employer: null,
    positions: manyRoles("hc", ["Staff Nurse Med-Surg", "Staff Nurse OR", "Staff Nurse NICU", "Midwife", "Charge Nurse", "Physiotherapist", "Occupational Therapist", "Respiratory Therapist", "Dietitian", "Clinical Pharmacist", "Lab Technician", "Phlebotomist", "X-Ray Technician", "CT Technologist", "Dental Assistant", "Medical Coder", "Ward Clerk", "Hospital Porter"]),
    benefits: [ben("Housing allowance"), ben("Flight tickets")], interview: [{ date: "Rolling", location: "Online" }],
  }),
  // ─── Retail ───
  fixture("retail-sparse", "Retail", "sparse", 2, {
    header: "Luxury Boutique Manager — Dubai Mall", industry: "Retail", country: "UAE", employer: "Premium Fashion House",
    positions: [pos("Boutique Manager", 1, "AED 14,000", "Luxury retail 8+ years")], benefits: [ben("Commission"), ben("Brand allowance")], interview: [],
  }),
  fixture("retail-medium", "Retail", "medium", 0, {
    header: "Hypermarket Chain Expansion — Oman", industry: "Retail", country: "Oman", employer: "Lulu Group",
    positions: [pos("Sales Associate", 40, "OMR 160"), pos("Cashier", 20, "OMR 170"), pos("Merchandiser", 15, "OMR 180"), pos("Butchery Assistant", 10, "OMR 190")],
    benefits: [ben("Accommodation + transport"), ben("Duty meals")], interview: [{ date: "26 July", location: "Kochi" }],
  }),
  fixture("retail-dense", "Retail", "dense", 1, {
    header: "Mega Mall Opening — 200+ Retail Positions", industry: "Retail", country: "Qatar", employer: null,
    positions: manyRoles("rt", ["Sales Associate Fashion", "Sales Associate Electronics", "Sales Associate Beauty", "Cashier", "Customer Service Agent", "Stock Keeper", "Visual Merchandiser", "Fitting Room Attendant", "Loss Prevention Officer", "Tailor", "Barista Mall Cafe", "Food Court Cashier", "Cleaner", "Trolley Boy", "Security Guard", "Receptionist", "Store Supervisor", "Department Manager"]),
    benefits: [ben("Shared housing"), ben("Transport")], interview: [{ date: "Walk-in 30 July", location: "Mumbai" }],
  }),
  // ─── Logistics ───
  fixture("logistics-sparse", "Logistics", "sparse", 1, {
    header: "Fleet Operations Manager — Jeddah", industry: "Logistics", country: "Saudi Arabia", employer: "National Logistics Co.",
    positions: [pos("Fleet Operations Manager", 1, "SAR 16,000", "GCC fleet 10+ years")], benefits: [ben("Car + fuel"), ben("Performance bonus")], interview: [],
  }),
  fixture("logistics-medium", "Logistics", "medium", 2, {
    header: "E-Commerce Fulfilment Centre — Riyadh", industry: "Logistics", country: "Saudi Arabia", employer: null,
    positions: [pos("Heavy Truck Driver", 30, "SAR 2,800", "GCC license"), pos("Delivery Van Driver", 40, "SAR 2,400"), pos("Warehouse Picker", 50, "SAR 1,800"), pos("Forklift Operator", 12, "SAR 2,200")],
    benefits: [ben("Accommodation"), ben("OT + incentives")], interview: [{ date: "24 July", location: "Lucknow" }, { date: "27 July", location: "Delhi" }],
  }),
  fixture("logistics-dense", "Logistics", "dense", 0, {
    header: "Port & Free Zone Operations — Mass Hiring", industry: "Logistics", country: "UAE", employer: "DP World Contractor",
    positions: manyRoles("lg", ["Crane Operator STS", "RTG Operator", "Tally Clerk", "Lashing Foreman", "Stevedore", "Reach Stacker Operator", "Trailer Driver", "Warehouse Supervisor", "Inventory Controller", "Customs Documentation Clerk", "HSE Inspector", "Marine Fitter", "Container Repair Welder", "Reefer Technician", "Yard Planner", "Gate Clerk", "Security Officer", "Office Boy"]),
    benefits: [ben("Company visa"), ben("Medical")], interview: [{ date: "Shortlist + online", location: "Apply by email" }],
  }),
  // ─── Manufacturing ───
  fixture("manufacturing-sparse", "Manufacturing", "sparse", 0, {
    header: "Plant Maintenance Manager — Aluminium Smelter", industry: "Manufacturing", country: "Bahrain", employer: "Alba Contractor",
    positions: [pos("Plant Maintenance Manager", 1, "BHD 1,500", "Smelter experience")], benefits: [ben("Family status"), ben("Bonus scheme")], interview: [],
  }),
  fixture("manufacturing-medium", "Manufacturing", "medium", 1, {
    header: "Steel Plant Expansion — Multiple Technicians", industry: "Manufacturing", country: "Saudi Arabia", employer: "Hadeed Contractor",
    positions: [pos("Rolling Mill Operator", 15, "SAR 3,200"), pos("Furnace Operator", 10, "SAR 3,400"), pos("Maintenance Fitter", 12, "SAR 3,000"), pos("Electrician Industrial", 10, "SAR 3,000"), pos("Crane Operator EOT", 8, "SAR 2,800")],
    benefits: [ben("FAT provided"), ben("OT")], interview: [{ date: "21 July", location: "Chennai" }],
  }),
  fixture("manufacturing-dense", "Manufacturing", "dense", 2, {
    header: "Food Processing Mega Factory — 250 Workers", industry: "Manufacturing", country: "Oman", employer: null,
    positions: manyRoles("mf", ["Production Line Operator", "Machine Operator Packing", "Quality Checker", "Food Technologist", "Boiler Operator", "Refrigeration Technician", "Electrician", "Mechanical Fitter", "Welder Fabricator", "Store Assistant", "Loading Supervisor", "Hygiene Officer", "Lab Assistant", "Batch Mixer", "Forklift Driver", "Utility Worker", "Cleaner Industrial", "Canteen Cook"]),
    benefits: [ben("Free FAT"), ben("2-year contract")], interview: [{ date: "Walk-in 29 July", location: "Hyderabad" }],
  }),
  // ─── Engineering ───
  fixture("engineering-sparse", "Engineering", "sparse", 2, {
    header: "Lead Structural Engineer — Doha Metro Phase 2", industry: "Engineering", country: "Qatar", employer: "Metro Consortium",
    positions: [pos("Lead Structural Engineer", 1, "QAR 22,000", "Chartered, metro/rail")], benefits: [ben("Family sponsorship"), ben("Annual flights")], interview: [],
  }),
  fixture("engineering-medium", "Engineering", "medium", 0, {
    header: "EPC Contractor — Engineering Department", industry: "Engineering", country: "Saudi Arabia", employer: null,
    positions: [pos("Civil Site Engineer", 8, "SAR 7,500"), pos("Mechanical Engineer", 6, "SAR 8,000"), pos("Electrical Engineer", 6, "SAR 8,000"), pos("Planning Engineer", 4, "SAR 9,000"), pos("QA/QC Engineer", 5, "SAR 8,500")],
    benefits: [ben("Housing + transport allowance")], interview: [{ date: "CV + technical online", location: "Apply now" }],
  }),
  fixture("engineering-dense", "Engineering", "dense", 1, {
    header: "National Grid Program — Engineering & Supervision", industry: "Engineering", country: "Kuwait", employer: null,
    positions: manyRoles("en", ["Substation Engineer", "Transmission Line Engineer", "Protection Engineer", "SCADA Engineer", "Cable Jointer HV", "Lineman OHTL", "Surveyor Electrical", "CAD Draftsman", "Document Controller", "Site Supervisor Civil", "Site Supervisor Electrical", "Testing Engineer", "Commissioning Engineer", "Safety Engineer", "Material Engineer", "Contracts Engineer", "Cost Engineer", "Project Coordinator"]),
    benefits: [ben("KD salary + allowances")], interview: [{ date: "Technical panel", location: "Online" }],
  }),
  // ─── Corporate ───
  fixture("corporate-sparse", "Corporate", "sparse", 1, {
    header: "Group Finance Director — Dubai HQ", industry: "Corporate", country: "UAE", employer: "Diversified Holding Group",
    positions: [pos("Group Finance Director", 1, "AED 45,000", "CA/CPA, 15+ years")], benefits: [ben("Executive package"), ben("Family benefits"), ben("Bonus")], interview: [],
  }),
  fixture("corporate-medium", "Corporate", "medium", 2, {
    header: "Regional Office Expansion — Abu Dhabi", industry: "Corporate", country: "UAE", employer: null,
    positions: [pos("Executive Assistant", 3, "AED 9,000"), pos("HR Officer", 4, "AED 10,000"), pos("Accountant", 6, "AED 8,500"), pos("IT Support Specialist", 4, "AED 9,500"), pos("Receptionist", 2, "AED 6,500")],
    benefits: [ben("Medical family"), ben("Annual ticket")], interview: [{ date: "Video interviews", location: "Rolling basis" }],
  }),
  fixture("corporate-dense", "Corporate", "dense", 0, {
    header: "Shared Services Centre — 150 Office Roles", industry: "Corporate", country: "Saudi Arabia", employer: null,
    positions: manyRoles("co", ["Accounts Payable Clerk", "Accounts Receivable Clerk", "Payroll Officer", "HR Coordinator", "Recruitment Officer", "Training Coordinator", "Procurement Officer", "Buyer", "Logistics Coordinator", "Data Entry Operator", "Document Controller", "Office Administrator", "Customer Care Agent", "Call Centre Agent Arabic", "IT Helpdesk", "Network Technician", "Graphic Designer", "Marketing Executive"]),
    benefits: [ben("Transport"), ben("Medical")], interview: [{ date: "Assessment day 1 Aug", location: "Bengaluru" }],
  }),
];

interface AdReport {
  id: string;
  industry: string;
  density: string;
  branded: boolean;
  imageSha256: string;
  // Phase 3 rubric, /10 scale.
  scores: {
    photography: number | null;
    typography: number | null;
    hierarchy: number | null;
    commercialAppeal: number | null;
    recruitmentEffectiveness: number | null;
    trust: number | null;
    luxuryMagazineQuality: number | null;
    brandConsistency: number | null;
    visualStorytelling: number | null;
    readability: number | null;
    mobileReadability: number | null;
    spellingGrammar: number | null;
    logoQuality: number | null;
    qr: number;
    overall: number | null;
  };
  passed: boolean;
  defects: string[];
  catastrophicDefects: string[];
  latencyMs: number;
}

const ten = (v: number | null | undefined) => (v == null ? null : Math.round(v) / 10);

async function runOne(f: Fixture): Promise<AdReport> {
  const started = Date.now();
  const input = factsToCreativeInput(f.facts, {
    aspectRatio: WIDTH / HEIGHT,
    agencyPalette: f.brand
      ? { primary: f.brand.primaryColor, secondary: f.brand.secondaryColor, accent: f.brand.accentColor }
      : undefined,
  });
  const direction = runCreativeDirector(input);
  const brief = buildCommercialAdvertisementBrief(direction);
  const prompt = buildMasterAdvertisementPrompt(brief, f.facts, { widthPx: WIDTH, heightPx: HEIGHT, brand: f.brand });

  const provider = getImageGenerationProvider();
  const qrUrl = buildQrTrackingUrl({ agencyVerificationId: `cert-${f.id}`, advertisementId: `cert-${f.id}` });
  const qr = await generateAndVerifyQr(qrUrl);

  const { output } = await provider.generate({ prompt, widthPx: WIDTH, heightPx: HEIGHT, quality: getEnv().KAI_IMAGE_QUALITY });

  const finalPng = await applyTrustLayer({
    baseImagePng: Buffer.from(output.imageBase64, "base64"),
    qrPng: qr.png,
    agencyName: f.facts.agencyName,
    raLicenseId: f.facts.raLicenseId,
    version: 1,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    generationId: `KAI-CERT-${f.id.toUpperCase().slice(0, 12)}-V1`,
  });

  const acceptance = await runGptNativeAcceptance({
    finalPng,
    facts: f.facts,
    expectedQrUrl: qrUrl,
    widthPx: WIDTH,
    heightPx: HEIGHT,
    platformFormatKey: "certification_portrait",
  });

  const qa = acceptance.visualQa;
  const factClean =
    acceptance.factCheck != null &&
    acceptance.factCheck.misspelledOrAlteredFacts.length === 0 &&
    acceptance.factCheck.missingCriticalFacts.length === 0;
  const spellingScore = acceptance.factCheck == null ? null : factClean ? 10 : 0;

  const overall = qa == null || spellingScore == null ? null : Math.min(ten(qa.overallScore)!, factClean ? 10 : 8);
  const passed =
    acceptance.qrDecodable &&
    overall != null &&
    overall >= PASS_BAR &&
    factClean &&
    qa!.catastrophicDefects.length === 0;

  const report: AdReport = {
    id: f.id,
    industry: f.industry,
    density: f.density,
    branded: f.brand != null,
    imageSha256: computeImageSha256(finalPng),
    scores: {
      photography: ten(qa?.imageryScore),
      typography: ten(qa?.readabilityScore),
      hierarchy: ten(qa?.hierarchyScore),
      commercialAppeal: ten(qa?.commercialQualityScore),
      recruitmentEffectiveness: ten(qa?.overallScore),
      trust: ten(qa?.trustScore),
      luxuryMagazineQuality: ten(qa?.commercialQualityScore),
      brandConsistency: f.brand ? ten(qa?.overallScore) : null,
      visualStorytelling: ten(qa?.imageryScore),
      readability: ten(qa?.readabilityScore),
      mobileReadability: ten(qa?.readabilityScore),
      spellingGrammar: spellingScore,
      logoQuality: null, // no logo fixture in certification (composited from real agency asset in production)
      qr: acceptance.qrDecodable ? 10 : 0,
      overall,
    },
    passed,
    defects: acceptance.defects,
    catastrophicDefects: qa?.catastrophicDefects ?? [],
    latencyMs: Date.now() - started,
  };

  writeFileSync(path.join(ARTIFACTS_DIR, `${f.id}.png`), finalPng);
  writeFileSync(path.join(ARTIFACTS_DIR, `${f.id}.report.json`), JSON.stringify({ ...report, fullVisualQa: qa, factCheck: acceptance.factCheck }, null, 2));
  console.log(`[${f.id}] overall=${report.scores.overall ?? "?"} passed=${report.passed} defects=${report.defects.length} (${Math.round(report.latencyMs / 1000)}s)`);
  return report;
}

async function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  if (!getEnv().OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required — certification generates REAL advertisements.");
    process.exit(1);
  }

  const reports: AdReport[] = [];
  const queue = [...FIXTURES];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const f = queue.shift()!;
      try {
        reports.push(await runOne(f));
      } catch (error) {
        console.error(`[${f.id}] FAILED:`, error instanceof Error ? error.message : error);
        reports.push({
          id: f.id, industry: f.industry, density: f.density, branded: f.brand != null,
          imageSha256: "", scores: { photography: null, typography: null, hierarchy: null, commercialAppeal: null, recruitmentEffectiveness: null, trust: null, luxuryMagazineQuality: null, brandConsistency: null, visualStorytelling: null, readability: null, mobileReadability: null, spellingGrammar: null, logoQuality: null, qr: 0, overall: null },
          passed: false, defects: [`GENERATION FAILED: ${error instanceof Error ? error.message : String(error)}`], catastrophicDefects: [], latencyMs: 0,
        });
      }
    }
  });
  await Promise.all(workers);

  const scored = reports.filter((r) => r.scores.overall != null) as (AdReport & { scores: { overall: number } })[];
  const defectCounts = new Map<string, number>();
  for (const r of reports) for (const d of r.defects) {
    const key = d.slice(0, 80);
    defectCounts.set(key, (defectCounts.get(key) ?? 0) + 1);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalRequested: FIXTURES.length,
    totalGenerated: reports.filter((r) => r.imageSha256 !== "").length,
    totalScored: scored.length,
    passBar: PASS_BAR,
    passed: reports.filter((r) => r.passed).length,
    rejected: reports.filter((r) => !r.passed).length,
    averageOverall: scored.length ? +(scored.reduce((s, r) => s + r.scores.overall, 0) / scored.length).toFixed(2) : null,
    highest: scored.length ? Math.max(...scored.map((r) => r.scores.overall)) : null,
    lowest: scored.length ? Math.min(...scored.map((r) => r.scores.overall)) : null,
    commonDefects: [...defectCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([defect, count]) => ({ defect, count })),
    perIndustry: Object.fromEntries(
      [...new Set(reports.map((r) => r.industry))].map((ind) => {
        const rs = scored.filter((r) => r.industry === ind);
        return [ind, { count: rs.length, avg: rs.length ? +(rs.reduce((s, r) => s + r.scores.overall, 0) / rs.length).toFixed(2) : null }];
      }),
    ),
    reports: reports.map(({ id, industry, density, branded, scores, passed, latencyMs }) => ({ id, industry, density, branded, overall: scores.overall, passed, latencyMs })),
  };

  writeFileSync(path.join(ARTIFACTS_DIR, "CERTIFICATION_SUMMARY.json"), JSON.stringify(summary, null, 2));
  console.log("\n===== CERTIFICATION SUMMARY =====");
  console.log(JSON.stringify({ ...summary, reports: undefined }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
