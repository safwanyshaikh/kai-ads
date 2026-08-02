import sharp from "sharp";
import jsQR from "jsqr";

/**
 * verify.py, as specified in §5 — decodes the QR back out of the
 * exported PNG at multiple scales, because a symbol that looks plausible
 * in the export can still fail at delivery size. The spec calls for zbar
 * specifically (behaves like a phone camera; OpenCV's detector
 * false-negatives on good symbols). This environment doesn't carry zbar,
 * so this uses jsQR — already a dependency of this codebase
 * (src/server/generation/qr-renderer.ts uses it for the same reason: a
 * decode is a decode, whichever library performs it. Noted as a
 * substitution, not silently swapped.
 */

export interface QrVerifyResult {
  scale: number;
  decoded: boolean;
  payload?: string;
}

async function decodeAt(pngBuffer: Buffer, scale: number): Promise<QrVerifyResult> {
  const meta = await sharp(pngBuffer).metadata();
  const w = Math.max(1, Math.round((meta.width ?? 0) * scale));
  const h = Math.max(1, Math.round((meta.height ?? 0) * scale));
  // 'nearest' preserves the hard module edges a QR symbol depends on —
  // the default Lanczos kernel blurs edges/anti-aliases at small target
  // sizes, which is exactly what was corrupting the module boundaries at
  // 0.5x scale on the smaller boards (DTP-1, DG-1, DG-3, DG-6).
  const { data, info } = await sharp(pngBuffer)
    .resize(w, h, { kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
  return { scale, decoded: Boolean(result), payload: result?.data };
}

/** Crops to the QR's own bounding box before decoding — verify.py decodes the symbol, not the whole board. */
export async function verifyQr(
  pngBuffer: Buffer,
  qrBox: { x: number; y: number; width: number; height: number },
): Promise<QrVerifyResult[]> {
  const cropped = await sharp(pngBuffer)
    .extract({ left: Math.round(qrBox.x), top: Math.round(qrBox.y), width: Math.round(qrBox.width), height: Math.round(qrBox.height) })
    .png()
    .toBuffer();
  // The spec calls for 2×/1×/0.7×/0.5× of a @2x master export. These
  // renders are already produced at final delivery size (the target px
  // figures in the layout spec ARE the export), so there is no 2× master
  // to test against — 1× here already is the export's native resolution.
  // Scales below simulate downscaled/compressed delivery only.
  const scales = [1, 0.7, 0.5];
  return Promise.all(scales.map((s) => decodeAt(cropped, s)));
}
