/**
 * V2 real-generation batch — 20 ads across 10 industries, exercising the
 * exact 3-step pipeline as shipped (generate.ts), no changes. Used to
 * gather real evidence of recurring failures before touching the
 * Creative Brief prompt. No acceptance/QA logic here — every image is
 * reviewed by eye afterward, per the "no new engines" instruction.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateAdvertisementV2 } from "@/server/generation-v2/generate";
import { getEnv } from "@/lib/env";

const OUT_DIR = path.join(process.cwd(), "scripts/adhoc/out/v2-batch");
const CONCURRENCY = 4;

interface Fixture {
  id: string;
  industry: string;
  recruiterText: string;
  footerText: string;
}

const FIXTURES: Fixture[] = [
  {
    id: "oilgas-1",
    industry: "Oil & Gas",
    recruiterText: `Hiring for Saudi Arabia.
Oil & Gas Maintenance.
Electrical Technician.
Salary up to SR 2,500.
Minimum 5 years experience.
Free accommodation.
Immediate requirement.`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "oilgas-2",
    industry: "Oil & Gas",
    recruiterText: `Bilfinger Shutdown Project - Saudi Arabia
Welder TIG 6G - 12 openings - SAR 2,500
Instrument Technician - 8 openings
Rotating Equipment Technician - 6 openings
Basic + 4 hrs OT daily, food & accommodation
Interview 14-15 July at Baroda`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "construction-1",
    industry: "Construction",
    recruiterText: `Project Manager needed - NEOM Giga Project, Saudi Arabia
PMP certified, 12+ years GCC experience
SAR 25,000 salary
Executive housing + family visa provided`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "construction-2",
    industry: "Construction",
    recruiterText: `Dubai high-rise tower project hiring:
Shuttering Carpenter x40 - AED 1,400
Steel Fixer x35 - AED 1,400
Mason x30 - AED 1,500
Free food, accommodation, transport, overtime
Interview 22 July Delhi`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "healthcare-1",
    industry: "Healthcare",
    recruiterText: `Consultant Radiologist needed - Kuwait Ministry Hospital
Board certified required
KWD 3,200 salary
Family status + education allowance`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "healthcare-2",
    industry: "Healthcare",
    recruiterText: `New specialty hospital opening in Riyadh
Staff Nurse ICU x20 - DHA/Prometric - SAR 5,500
Staff Nurse ER x15 - SAR 5,500
Pharmacist x5 - SAR 6,500
Free accommodation, annual ticket, malpractice cover`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "hospitality-1",
    industry: "Hospitality",
    recruiterText: `Executive Chef - 5-star resort Ras Al Khaimah UAE
Mediterranean cuisine, 5-star background required
AED 15,000 salary
Service charge, duty meals, accommodation`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "hospitality-2",
    industry: "Hospitality",
    recruiterText: `Palace Hotel pre-opening Doha Qatar
Front Office Agent x10 - QAR 2,200
Housekeeping Attendant x30 - QAR 1,600
Waiter/Waitress x25 - QAR 1,800
Shared accommodation, duty meals, medical
Interview 28-29 July Mumbai`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "retail-1",
    industry: "Retail",
    recruiterText: `Luxury Boutique Manager - Dubai Mall UAE
8+ years luxury retail experience
AED 14,000 salary
Commission + brand allowance`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "retail-2",
    industry: "Retail",
    recruiterText: `Lulu Group hypermarket expansion - Oman
Sales Associate x40 - OMR 160
Cashier x20 - OMR 170
Merchandiser x15 - OMR 180
Accommodation + transport, duty meals`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "manufacturing-1",
    industry: "Manufacturing",
    recruiterText: `Plant Maintenance Manager - Aluminium Smelter Bahrain
Smelter experience required
BHD 1,500 salary
Family status + bonus scheme`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "manufacturing-2",
    industry: "Manufacturing",
    recruiterText: `Steel plant expansion Saudi Arabia - Hadeed Contractor
Rolling Mill Operator x15 - SAR 3,200
Furnace Operator x10 - SAR 3,400
Maintenance Fitter x12 - SAR 3,000
FAT provided, overtime
Interview 21 July Chennai`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "marine-1",
    industry: "Marine",
    recruiterText: `Marine Chief Engineer - Bahrain Dry Docks (ASRY)
Class 1 CoC required
BHD 1,200 salary
Family status + schooling allowance`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "marine-2",
    industry: "Marine",
    recruiterText: `Drydocks World ship repair yard UAE - multiple trades
Ship Fitter x25 - AED 1,800
Hull Welder 6G x30 - AED 2,200
Blaster/Painter x15 - AED 1,600
Accommodation + transport, OT available
Interview 20 July Chennai, 23 July Cochin`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "logistics-1",
    industry: "Logistics",
    recruiterText: `Fleet Operations Manager - National Logistics Co, Jeddah Saudi Arabia
10+ years GCC fleet experience
SAR 16,000 salary
Car + fuel, performance bonus`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "logistics-2",
    industry: "Logistics",
    recruiterText: `E-commerce fulfilment centre Riyadh Saudi Arabia
Heavy Truck Driver x30 - GCC license - SAR 2,800
Warehouse Picker x50 - SAR 1,800
Forklift Operator x12 - SAR 2,200
Accommodation, OT + incentives`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "powerenergy-1",
    industry: "Power & Energy",
    recruiterText: `Hiring for Saudi Arabia
Power & Energy - substation project
Testing & Commissioning Engineer
Protection Engineer
Bachelor's Degree Electrical, 5+ years experience must
Salary Range 5K to 7K Basic, varies based on interview`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "powerenergy-2",
    industry: "Power & Energy",
    recruiterText: `Renewable energy site expansion - Oman
Solar Technician x20
Site Electrician x15
2-year contract, free FAT (food accommodation transport)`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "corporate-1",
    industry: "Corporate",
    recruiterText: `Group Finance Director - Dubai HQ UAE
CA/CPA qualified, 15+ years experience
AED 45,000 salary
Executive package, family benefits, bonus`,
    footerText: "Al Yousuf Enterprises LLP",
  },
  {
    id: "corporate-2",
    industry: "Corporate",
    recruiterText: `Regional office expansion Abu Dhabi UAE
Executive Assistant x3 - AED 9,000
HR Officer x4 - AED 10,000
Accountant x6 - AED 8,500
Medical family, annual ticket`,
    footerText: "Al Yousuf Enterprises LLP",
  },
];

interface Result {
  id: string;
  industry: string;
  ok: boolean;
  error?: string;
  bytes?: number;
}

async function runOne(f: Fixture): Promise<Result> {
  try {
    const png = await generateAdvertisementV2({
      recruiterText: f.recruiterText,
      footerText: f.footerText,
    });
    writeFileSync(path.join(OUT_DIR, `${f.id}.png`), png);
    writeFileSync(path.join(OUT_DIR, `${f.id}.input.txt`), f.recruiterText);
    console.log(`[${f.id}] OK — ${png.length} bytes`);
    return { id: f.id, industry: f.industry, ok: true, bytes: png.length };
  } catch (error) {
    console.error(`[${f.id}] FAILED:`, error instanceof Error ? error.message : error);
    return { id: f.id, industry: f.industry, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (!getEnv().OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required.");
    process.exit(1);
  }

  const results: Result[] = [];
  const queue = [...FIXTURES];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const f = queue.shift();
      if (!f) break;
      results.push(await runOne(f));
    }
  });
  await Promise.all(workers);

  writeFileSync(path.join(OUT_DIR, "MANIFEST.json"), JSON.stringify({ results }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\nDone: ${results.length - failed.length}/${results.length} succeeded.`);
  if (failed.length > 0) console.log("Failed:", failed.map((f) => f.id).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
