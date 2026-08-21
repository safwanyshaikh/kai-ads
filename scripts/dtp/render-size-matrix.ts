/** DTP classified size-matrix acceptance render. Invented agencies only. */
import fs from "node:fs";
import sharp from "sharp";
import { renderDtpClassifiedSvg, dtpTenantLogo, type DtpAdvertisement } from "../../src/server/generation/dtp";
import { pxToCm } from "../../src/lib/dtp-format-law";

const OUT = "/tmp/claude-0/-home-user-kai-ads/50a9e56e-10d5-5f8f-99df-609ee450e470/scratchpad/dtp-matrix";
fs.mkdirSync(OUT, { recursive: true });
const DPI = 300;
const NAVY="#12284C", RED="#B3121D", GREEN="#0B5D34", BLACK="#111111";

async function logo(c: string) {
  return sharp({ create: { width: 300, height: 190, channels: 3, background: c } }).png().toBuffer();
}

// Eight different agencies / industries / densities — one per size.
async function cases(): Promise<{ h: number; ad: DtpAdvertisement; extra: Record<string, unknown> }[]> {
  return [
    { h: 5, ad: { headline:"Saudi Arabia", subhead:"Oil & Gas", tenant:{name:"Novara HR", registrationText:"B-0101/MUM/PART/1000+/9986/2022"},
        positions:[{title:"Pipe Fabricator",count:12},{title:"Welder GTAW",count:10},{title:"Painter / Blaster",count:8}],
        salary:"Upto SR 2200 + Food", contactPhone:"8104 962797", accent:BLACK }, extra:{} },
    { h: 6, ad: { headline:"Qatar", subhead:"LNG Maintenance", tenant:{name:"Meridian Gulf Staffing", registrationText:"B-4410/CHE/PER/1000+/5521/2015"},
        positions:[{title:"Instrument Tech.",count:8},{title:"Electrician",count:6},{title:"Scaffolder",count:14}],
        salary:"QR 1600 – 2200 + FAT", contactPhone:"8291 898055", accent:RED }, extra:{} },
    { h: 7, ad: { headline:"UAE", subhead:"Construction", urgency:"Urgent requirement", tenant:{name:"Crestpoint Manpower", registrationText:"B-2201/DEL/PER/1000+/4412/2019"},
        positions:[{title:"Mason",count:20},{title:"Carpenter",count:18},{title:"Steel Fixer",count:30},{title:"Electrician",count:9}],
        salary:"AED 1200 – 1400", benefits:["Free food","Accommodation","Transport"], contactPhone:"+91 22 6166 6688", accent:NAVY }, extra:{} },
    { h: 8, ad: { headline:"Oman", subhead:"Facility Management", urgency:"Urgent requirement for leading FM co.", tenant:{name:"Harbourline Overseas", registrationText:"B-1487/MUM/PART/1000+/9986/2022", logo: dtpTenantLogo(await logo(GREEN))},
        positions:[{title:"Maintenance Supervisor",count:4},{title:"Maintenance Engineer",count:6},{title:"HVAC Supervisor",count:4},{title:"Electrical Supervisor",count:4},{title:"Plumber",count:6},{title:"Multi Technician",count:10}],
        salary:"OMR 180 – 260 + Food", benefits:["Free Accommodation","Free Transportation","Medical Insurance","8 Hours Duty"],
        eligibility:["Min. 5 years experience in facility management"], interview:"Client interview in Mumbai · 10-11 July",
        contactPhone:"81049 62788", contactEmail:"jobs@example-agency.test", accent:GREEN },
      extra:{ interviewVenue:"Venue: Turbhe Office, Navi Mumbai", established:"Estd. 1984", addressLines:["Arihant Aura, A-601, 6th Floor,","Opp. Turbhe Railway Station,","Turbhe MIDC, Navi Mumbai - 400 705."] } },
    { h: 9, ad: { headline:"Kuwait", subhead:"Power Transmission", urgency:"Client interview shortly", tenant:{name:"Northwind Overseas", registrationText:"B-9987/MUM/PER/1000+/7914/2007", logo: dtpTenantLogo(await logo(NAVY))},
        client:{name:"Gulf Power Contracting"},
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
        client:{name:"Al Rashid Group"},
        positions:[{title:"Foreman – Civil / Electrical",count:6},{title:"Leadman – Mechanical",count:8},{title:"WPR – Aramco Approved",count:4},{title:"Operator – Mobile Crane 55T",count:5},{title:"Carpenter / Mason",count:22},{title:"Store Helper",count:9},{title:"Driver – HD / LD",count:12}],
        salary:"Attractive salary + OT", benefits:["Food","Accommodation","Transport","Insurance"],
        eligibility:["Must have experience in industrial projects","Preferably Oil & Gas"], interview:"Mumbai · 26 March",
        contactPhone:"8655 960411", contactEmail:"jobs@example-agency.test", accent:BLACK },
      extra:{ interviewVenue:"SAFCO Trade Test, Gami Industrial Park", established:"Estd. 1984",
        addressLines:["C-39A, Gami Industrial Park, 1st Floor,","Gala 23, Pawne KATA, Turbhe,","Navi Mumbai. Bus from Sanpada St."] } },
    { h:12, ad: { headline:"Saudi Arabia", subhead:"Catering & Hospitality", urgency:"Final client interview", tenant:{name:"Continental Overseas Manpower Consultancy", registrationText:"B-1487/MUM/PART/1000+/9986/2022", logo: dtpTenantLogo(await logo(NAVY))},
        client:{name:"Gulf Catering Services"},
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
    console.log(`6x${String(h).padEnd(2)}  ${String(r.widthPx)}x${String(r.heightPx).padEnd(5)} ${pxToCm(r.widthPx,DPI).toFixed(2)}x${pxToCm(r.heightPx,DPI).toFixed(2)}   ${r.tier.padEnd(8)} ${(r.fillRatio*100).toFixed(0)}%  ${r.plan.footer}/${on}`);
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
