/** DTP classified size-matrix acceptance render. Invented agencies only. */
import fs from "node:fs";
import sharp from "sharp";
import { renderDtpClassifiedSvg, dtpTenantLogo, dtpClientLogo, type DtpAdvertisement } from "../../src/server/generation/dtp";
import { pxToCm } from "../../src/lib/dtp-format-law";

const OUT = "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad/dtp-matrix";
fs.mkdirSync(OUT, { recursive: true });
const DPI = 300;
const NAVY="#12284C", RED="#B3121D", GREEN="#0B5D34", BLACK="#111111";

/** Invented marks at deliberately different aspect ratios. */
async function logo(c: string, w = 300, h = 190) {
  return sharp({ create: { width: w, height: h, channels: 3, background: c } }).png().toBuffer();
}

// Eight different agencies / industries / densities — one per size.
async function cases(): Promise<{ h: number; ad: DtpAdvertisement; extra: Record<string, unknown> }[]> {
  return [
    { h: 5, ad: { headline:"Hiring for – Saudi Arabia", tenant:{name:"Novara HR", registrationText:"B-0101/MUM/PART/1000+/9986/2022", logo: dtpTenantLogo(await logo(BLACK))},
        positions:[{title:"Pipe Fabricators",detail:"Upto SR 2000 + SR 300 Food"},{title:"Welder (GTAW+SMAW)",detail:"Upto SR 2200 + SR 300 Food"},{title:"Painter / Blaster",detail:"Upto SR 1500 + SR 300 Food"}],
        interview:"Client interview 4th & 5th June · Mumbai",
        contactPhone:"8104962797 / 8104962798", contactEmail:"jobs@example-agency.test", accent:BLACK },
      extra:{ established:"Estd. 1984", addressLines:["Interview venue: SAFCO Training Center,","Gami Industrial Park, Gala A-23, Pawne MIDC,","Near Turbhe Railway Stn, Navi Mumbai."] } },
    { h: 6, ad: { headline:"Qatar", subhead:"LNG Maintenance", tenant:{name:"Meridian Gulf Staffing", registrationText:"B-4410/CHE/PER/1000+/5521/2015"},
        positions:[{title:"Instrument Tech.",count:8,detail:"QR 2200 + FAT"},{title:"Electrician",count:6,detail:"QR 1800 + FAT"},{title:"Scaffolder",count:14,detail:"QR 1600 + FAT"}],
        interview:"Interview 12-13 August · Chennai",
        contactPhone:"8291 898055", contactEmail:"gulf@example-agency.test", accent:RED },
      extra:{ established:"Estd. 2001", addressLines:["18 Anna Salai, Chennai 600002."] } },
    { h: 7, ad: { headline:"UAE", subhead:"Construction", urgency:"Urgent requirement", tenant:{name:"Crestpoint Manpower", registrationText:"B-2201/DEL/PER/1000+/4412/2019"},
        positions:[{title:"Mason",count:20,detail:"AED 1400"},{title:"Carpenter",count:18,detail:"AED 1350"},{title:"Steel Fixer",count:30,detail:"AED 1300"},{title:"Electrician",count:9,detail:"AED 1200"}],
        benefits:["Free food","Accommodation","Transport"], interview:"Client interview 19th July · Mumbai",
        contactPhone:"+91 22 6166 6688", contactEmail:"apply@example-agency.test", accent:NAVY },
      extra:{ established:"Estd. 1991", addressLines:["Universal Majestic, RBK Circle, Mumbai."] } },
    { h: 8, ad: { headline:"Oman", subhead:"Facility Management", urgency:"Urgent requirement for leading FM co.", tenant:{name:"Harbourline Overseas", registrationText:"B-1487/MUM/PART/1000+/9986/2022", logo: dtpTenantLogo(await logo(GREEN, 200, 320))},
        positions:[{title:"Maintenance Supervisor",count:4},{title:"Maintenance Engineer",count:6},{title:"HVAC Supervisor",count:4},{title:"Electrical Supervisor",count:4},{title:"Plumber",count:6},{title:"Multi Technician",count:10}],
        salary:"OMR 180 – 260 + Food", benefits:["Free Accommodation","Free Transportation","Medical Insurance","8 Hours Duty"],
        eligibility:["Min. 5 years experience in facility management"], interview:"Client interview in Mumbai · 10-11 July",
        contactPhone:"81049 62788", contactEmail:"jobs@example-agency.test", accent:GREEN },
      extra:{ interviewVenue:"Venue: Turbhe Office, Navi Mumbai", established:"Estd. 1984", addressLines:["Arihant Aura, A-601, 6th Floor,","Opp. Turbhe Railway Station,","Turbhe MIDC, Navi Mumbai - 400 705."] } },
    { h: 9, ad: { headline:"Kuwait", subhead:"Power Transmission", urgency:"Client interview shortly", tenant:{name:"Northwind Overseas", registrationText:"B-9987/MUM/PER/1000+/7914/2007", logo: dtpTenantLogo(await logo(NAVY))},
        client:{name:"Gulf Power Contracting", logo: dtpClientLogo(await logo(RED, 320, 320))},
        positions:[{title:"Lineman",count:14},{title:"Electrical Technician",count:12},{title:"Foreman",count:5},{title:"Safety Officer",count:4}],
        salary:"KD 180 – 250", benefits:["Food","Accommodation","Transport","Medical"],
        eligibility:["Minimum 5 years Gulf experience"], interview:"Interview 20-21 July · Mumbai",
        contactPhone:"+91 11 4000 2020", contactEmail:"hire@example-agency.test", accent:NAVY },
      extra:{ established:"Estd. 1996", addressLines:["8 Harbour Lane, New Delhi 110001"] } },
    { h:10, ad: { headline:"Bahrain", subhead:"Shipyard / Marine", urgency:"Urgent requirement", tenant:{name:"Anchor Point HR", registrationText:"B-3312/MUM/PER/1000+/6621/2018", logo: dtpTenantLogo(await logo(RED))},
        client:{name:"Arabian Marine Yard"},
        positions:[{title:"Ship Fitter",count:12},{title:"Welder 6G",count:20},{title:"Pipe Fitter",count:16},{title:"Rigger",count:10},{title:"Grinder",count:8}],
        salary:"BD 200 – 320 + OT", benefits:["Food allowance","Free visa","Medical","Transport"],
        eligibility:["Shipyard experience mandatory","Trade test in Mumbai"], interview:"Walk-in 20-21 July · Mumbai",
        contactPhone:"+91 22 6166 6688", contactEmail:"jobs@example-agency.test", accent:RED },
      extra:{ interviewVenue:"SAFCO Trade Test, Pawne MIDC, Navi Mumbai", established:"Estd. 1984",
        addressLines:["Gami Industrial Park, Gala 23,","Pawne KATA, Turbhe, Navi Mumbai."] } },
    { h:11, ad: { headline:"Saudi Arabia", subhead:"MASCO – Amiral Oil & Gas Project", urgency:"100% client interview", tenant:{name:"Silverline HR Consultants", registrationText:"B-1487/MUM/PART/1000+/9986/2022", logo: dtpTenantLogo(await logo(BLACK))},
        client:{name:"Al Rashid Group", logo: dtpClientLogo(await logo(GREEN, 420, 140))},
        positions:[{title:"Foreman – Civil / Electrical",count:6},{title:"Leadman – Mechanical",count:8},{title:"WPR – Aramco Approved",count:4},{title:"Operator – Mobile Crane 55T",count:5},{title:"Carpenter / Mason",count:22},{title:"Store Helper",count:9},{title:"Driver – HD / LD",count:12}],
        salary:"Attractive salary + OT", benefits:["Food","Accommodation","Transport","Insurance"],
        eligibility:["Must have experience in industrial projects","Preferably Oil & Gas"], interview:"Mumbai · 26 March",
        contactPhone:"8655 960411", contactEmail:"jobs@example-agency.test", accent:BLACK },
      extra:{ interviewVenue:"SAFCO Trade Test, Gami Industrial Park", established:"Estd. 1984",
        addressLines:["C-39A, Gami Industrial Park, 1st Floor,","Gala 23, Pawne KATA, Turbhe,","Navi Mumbai. Bus from Sanpada St."] } },
    { h:12, ad: { headline:"Saudi Arabia", subhead:"Catering & Hospitality", urgency:"Final client interview", tenant:{name:"Continental Overseas Manpower Consultancy", registrationText:"B-1487/MUM/PART/1000+/9986/2022", logo: dtpTenantLogo(await logo(NAVY))},
        client:{name:"Gulf Catering Services", logo: dtpClientLogo(await logo(RED, 260, 340))},
        positions:[{title:"Sous Chef",count:6},{title:"Catering Chef",count:6},{title:"Hospitality Supervisor",count:8},{title:"Dining Supervisor",count:8},{title:"Food Safety Officer",count:4},{title:"Storekeeper",count:5},{title:"Salad Maker",count:6},{title:"Rice Cook & Helper",count:10}],
        salary:"SR 1500 – 3000 + Food", benefits:["Food","Accommodation","Transport","Medical","Air ticket"],
        eligibility:["Minimum 3 years catering experience","Passport validity 2 years"], interview:"Mumbai 2-3 Sep · Kolkata 5 Sep",
        contactPhone:"81049 62788", contactEmail:"jobs@example-agency.test", accent:NAVY },
      extra:{ interviewVenue:"Walk-in: Turbhe Office, Navi Mumbai", established:"Estd. 1984",
        addressLines:["Arihant Aura, A-601, 6th Floor,","Opp. Turbhe Railway Station,","MIDC Turbhe, Navi Mumbai."] } },
  ] as never;
}

async function main() {
  const list = await cases();
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  let x = 0;
  const SCALE = 0.42;
  console.log("size   px            cm            tier      fill   sections");
  for (const { h, ad, extra } of list) {
    const r = renderDtpClassifiedSvg({ ad, heightCm: h as never, dpi: DPI, variant: "COLOUR", ...extra });
    const png = await sharp(Buffer.from(r.svg)).png().toBuffer();
    fs.writeFileSync(`${OUT}/ad-6x${h}.png`, png);
    const on = Object.entries(r.plan).filter(([, v]) => v === true).map(([k]) => k).join(",");
    console.log(`6x${String(h).padEnd(2)}  ${String(r.widthPx)}x${String(r.heightPx).padEnd(5)} ${pxToCm(r.widthPx,DPI).toFixed(2)}x${pxToCm(r.heightPx,DPI).toFixed(2)}   ${r.tier.padEnd(8)} ${(r.fillRatio*100).toFixed(0)}% g${(r.largestGapRatio*100).toFixed(0)}%  ${r.plan.footer}/${on}`);
    const t = await sharp(png).resize({ width: Math.round(r.widthPx * SCALE) }).toBuffer();
    const m = await sharp(t).metadata();
    tiles.push({ input: t, left: x, top: 0 });
    x += (m.width ?? 0) + 14;
  }
  const H = Math.max(...(await Promise.all(tiles.map(async t => (await sharp(t.input).metadata()).height ?? 0))));
  await sharp({ create: { width: x, height: H, channels: 3, background: "#8A8A8A" } })
    .composite(tiles).png().toFile(`${OUT}/matrix.png`);
  console.log(`\nmatrix -> ${OUT}/matrix.png`);
}
main().catch(e => { console.error(e); process.exit(1); });
