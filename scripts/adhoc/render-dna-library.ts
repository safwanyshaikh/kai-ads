import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { listDnas } from "@/server/generation/dna/registry";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts } from "@/server/generation/pipeline/types";

const TRADES = ["TIG Welder 6G","Pipe Fitter","Scaffolder","Rigger","Instrument Technician","Electrician","Mason","Steel Fixer","HVAC Technician","Crane Operator","Safety Officer","Store Keeper","Painter","Insulator","Carpenter","Plumber","Heavy Driver","Fabricator","Foreman","QC Inspector"];

function facts(n: number): AdvertisementFacts {
  return {
    header: "Urgent Requirement — Saudi Arabia",
    industry: "Oil & Gas",
    country: "Saudi Arabia",
    employer: "Bilfinger Middle East",
    projectType: "Refinery Shutdown 2026",
    visaType: "Work Visa",
    dutyHours: "10 hours/day, 6 days/week",
    rotation: "24 months",
    positions: Array.from({ length: n }, (_, i) => ({
      title: TRADES[i % TRADES.length],
      count: (i % 7) + 2,
      experience: "Min. 5 years",
      salary: `SAR ${1500 + (i % 6) * 300}`,
      qualification: "ITI / Diploma",
      certifications: i % 3 === 0 ? ["ARAMCO Approved"] : undefined,
    })),
    benefits: [{ label: "Free Food" }, { label: "Accommodation" }, { label: "Medical Insurance" }, { label: "Air Ticket" }],
    interview: [{ date: "12th September 2026", location: "Mumbai" }],
    contact: { phone: "+91 86559 60415", whatsapp: "+91 86559 60415", email: "jobs@example.com" },
    agencyName: "Al Yousuf Enterprises LLP",
    raLicenseId: "B-0655/MUM/PER",
    fullRegistrationNumber: "B-0655/MUM/PER/1000+/4-1/4/7914/2007",
  };
}

async function main() {
  const dir = process.argv[2];
  let fails = 0;
  for (const dna of listDnas()) {
    const n = dna.composition === "AAT_DTP" ? 24 : 6;
    try {
      const r = await renderFactLayer({ facts: facts(n), widthPx: 1080, heightPx: 1080, dna });
      const meta = await sharp(r.png).metadata();
      if (meta.width !== 1080 || meta.height !== r.heightPx) throw new Error(`size mismatch ${meta.width}x${meta.height}`);
      writeFileSync(`${dir}/${dna.id}.png`, r.png);
      console.log(`ok   ${dna.id.padEnd(6)} ${String(r.heightPx).padStart(5)}px hero=${String(r.artworkHeightPx).padStart(4)} ${dna.label}`);
    } catch (e) {
      fails++;
      console.log(`FAIL ${dna.id.padEnd(6)} ${(e as Error).message}`);
    }
  }
  console.log(fails === 0 ? "\nALL 50 RENDERED" : `\n${fails} FAILED`);
}
main();
