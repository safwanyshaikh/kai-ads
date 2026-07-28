import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";

/** No OpenAI call — synthetic background only, for validating the Branding Overlay's layout/watermark/footer band at zero API cost. */
async function main() {
  const outDir = path.join(process.cwd(), "scripts/adhoc/out");
  mkdirSync(outDir, { recursive: true });

  const base = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: { r: 40, g: 60, b: 90 } } }).png().toBuffer();
  const logo = readFileSync(path.join(process.cwd(), "scripts", "acceptance", "assets", "al-yousuf-logo.png"));
  const qr = await generateAndVerifyQr(buildQrTrackingUrl({ agencyVerificationId: "smoke", advertisementId: "smoke" }));
  const out = await applyBrandingOverlay({
    imagePng: base,
    widthPx: 1024,
    heightPx: 1536,
    agencyLogoPng: logo,
    qrPng: qr.png,
    agencyName: "Al-Yousuf Enterprises LLP",
    registrationNumber: "B-1487/MUM/PART/1000+/9986/2022",
    contactLine: "jobs@alyousufent.com | 8655960413",
  });
  writeFileSync(path.join(outDir, "branding-overlay-smoke-out.png"), out);
  console.log("wrote", out.length, "bytes");
}
main().catch((e) => { console.error(e); process.exit(1); });
