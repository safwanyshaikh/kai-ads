/**
 * DTP full-page acceptance render. Invented tenants only.
 */
import fs from "node:fs";
import sharp from "sharp";
import { renderDtpPage, dtpTenantLogo, dtpVerificationQr } from "../../src/server/generation/dtp";
import type { DtpAdvertisement } from "../../src/server/generation/dtp";

const OUT = "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad/dtp";
fs.mkdirSync(OUT, { recursive: true });

async function logo(c: string) {
  return sharp({ create: { width: 240, height: 150, channels: 3, background: c } }).png().toBuffer();
}
async function qr() {
  return sharp({ create: { width: 200, height: 200, channels: 3, background: "#000000" } }).png().toBuffer();
}

async function main() {
  const NAVY = "#12284C", RED = "#B3121D", GREEN = "#0B5D34", BLACK = "#111111";

  const ads: DtpAdvertisement[] = [
    { headline: "Saudi Arabia", subhead: "Oil & Gas Shutdown Project", urgency: "Urgent requirement",
      tenant: { name: "Novara HR", registrationText: "Licence: B-0101/DEL/PER/1000+/5-2/9/1121/2011", logo: dtpTenantLogo(await logo(NAVY)) },
      client: { name: "Gulf Petro Services" },
      positions: [
        { title: "Pipe Fitter", count: 25, detail: "5+ yrs · ITI" },
        { title: "Fabricator", count: 20 }, { title: "Welder 6G", count: 15, detail: "ARC/TIG" },
        { title: "Rigger", count: 12 }, { title: "Scaffolder", count: 10 },
      ],
      salary: "SAR 1800 – 2600 + OT", benefits: ["Free food", "Accommodation", "Transport", "Medical"],
      interview: "Interview 24-25 July · Mumbai", contactPhone: "+91 22 4000 1122",
      contactEmail: "jobs@novara.example", accent: NAVY, verificationQr: dtpVerificationQr(await qr()) },

    { headline: "Qatar", subhead: "LNG Maintenance", tenant: { name: "Meridian Gulf Staffing", registrationText: "Licence: B-4410/CHE/PER/1000+/3-3/2/5521/2015" },
      positions: [{ title: "Instrument Technician", count: 8 }, { title: "Electrician", count: 6 }],
      contactPhone: "+91 44 2200 9911", accent: RED },

    { headline: "Oman", subhead: "Facility Management", urgency: "Client interview shortly",
      tenant: { name: "Harbourline Overseas", logo: dtpTenantLogo(await logo(GREEN)) },
      positions: [
        { title: "Maintenance Supervisor", count: 4 }, { title: "HVAC Technician", count: 10, detail: "3+ yrs Gulf" },
        { title: "Plumber", count: 6 }, { title: "Mason", count: 8 },
      ],
      benefits: ["Accommodation", "Transport"], contactPhone: "+91 11 4000 2020", accent: GREEN },

    { headline: "UAE", tenant: { name: "Crestpoint Manpower" },
      positions: [{ title: "Steel Fixer", count: 30 }, { title: "Shuttering Carpenter", count: 30 }],
      salary: "AED 1200 – 1400", contactPhone: "8291 898055", accent: BLACK },

    { headline: "Kuwait", subhead: "Automotive Distribution", tenant: { name: "Northwind Overseas", registrationText: "Licence: B-9987/MUM/PER/1000+/4-1/4/7914/2007" },
      positions: [{ title: "Service Technician", count: 5, detail: "3-5 yrs, diploma" }, { title: "Auto Electrician", count: 4 }, { title: "Denter", count: 3 }, { title: "Painter", count: 3 }],
      eligibility: ["Passport validity 2 years minimum", "GCC licence preferred"],
      contactPhone: "+91 98100 00000", contactEmail: "hire@northwind.example", accent: NAVY },

    { headline: "Bahrain", subhead: "Shipyard Project", tenant: { name: "Anchor Point HR", logo: dtpTenantLogo(await logo(RED)) },
      positions: [{ title: "Ship Fitter", count: 12 }, { title: "Welder", count: 20 }, { title: "Grinder", count: 10 }],
      benefits: ["Food allowance", "Free visa"], interview: "Walk-in 20-21 July · Mumbai", contactPhone: "+91 22 6166 6688", accent: RED },

    { headline: "Malaysia", tenant: { name: "Eastgate Recruitment" },
      positions: [{ title: "CNC Operator", count: 15 }, { title: "Quality Inspector", count: 5 }],
      contactPhone: "+91 11 4187 6700", accent: BLACK },

    { headline: "Europe", subhead: "Long Term Work Permit", urgency: "Applications invited",
      tenant: { name: "Continental Overseas Manpower & Technical Consultancy Private Limited", registrationText: "Licence: B-9987/MUM/PER/1000+/4-1/4/7914/2007-VALID-UNTIL-2031" },
      positions: [{ title: "Electrician", count: 20 }, { title: "Welder", count: 25 }, { title: "Fitter", count: 20 }, { title: "Turner", count: 10 }, { title: "Machinist", count: 10 }],
      benefits: ["Food", "Accommodation", "Air ticket", "Insurance"],
      applicationNote: "Send CV with passport copy and experience certificates.",
      contactPhone: "7767 847070", contactEmail: "careers@continental-overseas.example", accent: NAVY,
      verificationQr: dtpVerificationQr(await qr()) },

    { headline: "Japan", subhead: "Manufacturing", tenant: { name: "Sakura Link HR" },
      positions: [{ title: "Factory Worker", count: 40 }, { title: "Food Packing", count: 25 }],
      salary: "¥ 1,20,000 – 1,90,000 / month", contactPhone: "+91 76610 97534", accent: RED },

    { headline: "Russia", subhead: "Power Transmission Lines", tenant: { name: "Tremain International" },
      positions: [{ title: "Delivery Boy", count: 60 }, { title: "Warehouse Helper", count: 60 }],
      eligibility: ["Basic English communication"], contactPhone: "8097 468005", accent: BLACK },

    { headline: "Singapore", subhead: "Marine Vessel Project", tenant: { name: "Oceanmate Marine Services", logo: dtpTenantLogo(await logo(NAVY)) },
      positions: [{ title: "Deck Hand", count: 10 }, { title: "Steward", count: 6 }, { title: "Cook", count: 4 }],
      contactPhone: "+91 22 4123 4567", accent: NAVY },

    { headline: "Canada", subhead: "Agri Farms", tenant: { name: "Greenland Overseas" },
      positions: [{ title: "Farm Worker", count: 50 }, { title: "Fruit Picker", count: 40 }, { title: "Packing Worker", count: 30 }],
      benefits: ["Accommodation", "Meals"], contactPhone: "+91 484 401 2385", accent: GREEN },
  ];

  // A real classified page carries dozens of advertisers. Extend the
  // hand-written set with further invented tenants so the page is
  // genuinely full, exercising every column and a wide spread of block
  // heights. Deterministic: no randomness anywhere.
  const DESTS: [string, string, string][] = [
    ["Saudi Arabia", "Petrochemical Shutdown", NAVY],
    ["UAE", "Infrastructure Package", BLACK],
    ["Qatar", "Facilities Contract", RED],
    ["Oman", "Refinery Turnaround", GREEN],
    ["Kuwait", "Civil Works", NAVY],
    ["Bahrain", "Marine Fabrication", RED],
    ["Poland", "Warehouse Operations", BLACK],
    ["Romania", "Industrial Assembly", GREEN],
  ];
  const TRADES: [string, number][][] = [
    [["Pipe Fitter", 18], ["Welder 6G", 14], ["Grinder", 8]],
    [["Electrician", 12], ["Instrument Technician", 9]],
    [["Scaffolder", 26], ["Rigger", 11], ["Painter", 7], ["Blaster", 6]],
    [["Mason", 15], ["Steel Fixer", 22], ["Carpenter", 18]],
    [["HVAC Technician", 10], ["Duct Man", 8], ["Insulator", 6]],
    [["Heavy Driver", 20], ["Light Driver", 12]],
    [["Store Keeper", 4], ["Safety Officer", 5], ["QA/QC Inspector", 3]],
  ];
  const FIRMS = ["Silverline HR", "Pinnacle Overseas", "Trident Manpower", "Ashwood Recruitment",
    "Kestrel Global HR", "Verity Overseas", "Larkfield Manpower", "Orion Placement Services",
    "Redmond Overseas", "Calder HR Consultants", "Fairmont Manpower", "Beacon Overseas Services",
    "Ridgeway Recruitment", "Stonebridge HR", "Westmark Overseas", "Halloway Manpower",
    "Ellisworth HR", "Thornbury Overseas", "Marchmont Recruitment", "Duncastle Manpower",
    "Ivorycrest HR", "Selwyn Overseas", "Brackley Manpower", "Cotswold Recruitment",
    "Pemberton HR", "Ashgrove Overseas", "Whitfield Manpower", "Langmere HR",
    "Rothwell Overseas", "Bexley Recruitment", "Aldbury Manpower", "Chesterton HR",
    "Ambleside HR", "Fenwick Overseas", "Garrowby Manpower", "Hollingsworth HR",
    "Inglewood Overseas", "Jarvis Manpower", "Kelmscott HR", "Linden Overseas",
    "Merrivale Manpower", "Norbury HR", "Oakhampton Overseas", "Prestwick Manpower",
    "Quarrydale HR", "Ravensworth Overseas", "Sandringham Manpower", "Tarnbrook HR",
    "Uppingham Overseas", "Vandenberg Manpower", "Wrenbury HR", "Yardley Overseas"];

  for (let i = 0; i < FIRMS.length; i++) {
    const [country, project, accent] = DESTS[i % DESTS.length];
    const trades = TRADES[i % TRADES.length];
    ads.push({
      headline: country,
      subhead: i % 3 === 0 ? project : null,
      urgency: i % 4 === 0 ? "Urgent requirement" : null,
      tenant: {
        name: FIRMS[i],
        registrationText: i % 2 === 0 ? `Licence: B-${2000 + i}/MUM/PER/1000+/${i}/2026` : null,
      },
      positions: trades.map(([t, n]) => ({ title: t, count: n })),
      salary: i % 5 === 0 ? "Attractive salary + OT" : null,
      benefits: i % 3 === 1 ? ["Food", "Accommodation", "Transport"] : [],
      interview: i % 6 === 0 ? "Client interview in progress" : null,
      contactPhone: `+91 ${20 + (i % 70)} ${4000 + i} ${1000 + i * 7}`,
      contactEmail: i % 4 === 1 ? `careers@${FIRMS[i].toLowerCase().replace(/[^a-z]/g, "")}.example` : null,
      accent,
    });
  }

  for (const format of ["png", "jpg", "pdf"] as const) {
    const r = await renderDtpPage({
      masthead: { title: "Overseas Assignments", edition: "Saturday, 18 July 2026 · Classified Recruitment", pageLabel: "3" },
      advertisements: ads,
    }, format);
    const f = `${OUT}/dtp-page.${format}`;
    fs.writeFileSync(f, r.buffer);
    if (format === "png") {
      console.log(`layout: ${r.layout.columnCount} columns @ ${r.layout.columnWidthPx}px, masthead ${r.layout.mastheadHeightPx}px`);
      console.log(`placed: ${r.layout.placements.length}/${ads.length}, unplaced: [${r.layout.unplaced.join(",")}]`);
      const perCol = new Map<number, number>();
      for (const p of r.layout.placements) perCol.set(p.column, (perCol.get(p.column) ?? 0) + 1);
      console.log("ads per column:", [...perCol.entries()].sort().map(([c, n]) => `c${c}=${n}`).join(" "));
      const heights = r.layout.placements.map((p) => p.heightPx);
      console.log(`block heights: min ${Math.min(...heights)} max ${Math.max(...heights)} (variable = ${new Set(heights).size > 1})`);
      await sharp(r.buffer).resize({ width: 1000 }).toFile(`${OUT}/dtp-page-preview.png`);
    }
    console.log(`${format.toUpperCase().padEnd(3)} ${r.buffer.length} bytes -> ${f}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
