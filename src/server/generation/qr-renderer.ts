import QRCode from "qrcode";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { getEnv } from "@/lib/env";

interface QrGenerationResult {
  png: Buffer;
  decodable: boolean;
  decodedValue: string | null;
}

/**
 * QR Architecture (Sprint 004): the tracking URL, never the official
 * MEA/eMigrate destination directly — see qr-scan.service.ts for the
 * redirect that happens when this URL is actually visited.
 */
export function buildQrTrackingUrl(params: {
  agencyVerificationId: string;
  advertisementId: string;
}): string {
  const env = getEnv();
  const base = env.KAI_PUBLIC_DOMAIN.replace(/\/$/, "");
  return `${base}/v/${params.agencyVerificationId}?a=${params.advertisementId}`;
}

/**
 * "Every generated advertisement must pass automated QR decoding
 * verification before it can be marked ready. If KAI cannot decode its
 * own generated QR: BLOCK READY STATUS."
 *
 * This isn't a claim — it generates a real PNG (the `qrcode` package),
 * decodes that exact PNG with a real QR reader (`jsqr`, via `pngjs` to
 * get raw pixels), and reports whether decoding actually succeeded and
 * whether the decoded payload matches what was encoded. Callers
 * (trust-validation.service.ts) block TRUST_READY on `decodable: false`.
 */
export async function generateAndVerifyQr(url: string): Promise<QrGenerationResult> {
  const png = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    margin: 4, // adequate quiet zone — required for reliable decoding, never trimmed for "compactness"
    width: 512,
  });

  try {
    const decodedPng = PNG.sync.read(png);
    const result = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);

    return {
      png,
      decodable: result !== null && result.data === url,
      decodedValue: result?.data ?? null,
    };
  } catch {
    return { png, decodable: false, decodedValue: null };
  }
}
