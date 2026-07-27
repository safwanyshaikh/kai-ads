/**
 * Real GPT-Native V2 test — proves the image model owns the entire
 * canvas, no reserved zone, no template. Requires OPENAI_API_KEY.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateAdvertisementV2 } from "@/server/generation-v2/generate";
import { getEnv } from "@/lib/env";

const OUT_DIR = path.join(process.cwd(), "scripts/adhoc/out");

const recruiterText = `Hiring for Saudi Arabia.
Oil & Gas Maintenance.
Electrical Technician.
Salary up to SR 2,500.
Minimum 5 years experience.
Free accommodation.
Immediate requirement.`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (!getEnv().OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required.");
    process.exit(1);
  }

  const png = await generateAdvertisementV2({
    recruiterText,
    footerText: "Al Yousuf Enterprises LLP",
  });

  writeFileSync(path.join(OUT_DIR, "v2-real-test.png"), png);
  console.log("Wrote v2-real-test.png —", png.length, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
