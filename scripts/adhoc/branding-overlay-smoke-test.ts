import { writeFileSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { applyBrandingOverlay } from "@/server/generation/pipeline/branding-overlay";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";

async function main() {
  const base = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: { r: 40, g: 60, b: 90 } } }).png().toBuffer();
  const logo = readFileSync("/tmp/v2-logo.png");
  const qr = await generateAndVerifyQr(buildQrTrackingUrl({ agencyVerificationId: "smoke", advertisementId: "smoke" }));
  const out = await applyBrandingOverlay({
    imagePng: base, widthPx: 1024, heightPx: 1536,
    agencyLogoPng: logo, qrPng: qr.png, footerText: "Al Yousuf Enterprises LLP",
  });
  writeFileSync("scripts/adhoc/out/v2-smoke-out.png", out);
  console.log("wrote", out.length, "bytes");
}
main().catch((e) => { console.error(e); process.exit(1); });
