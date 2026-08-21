import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  applyBrandingOverlay,
  brandingStripHeight,
  trustFooterHeight,
  type FooterContent,
} from "@/server/generation/pipeline/branding-overlay";
import { renderFactLayer } from "@/server/generation/pipeline/fact-layer";
import type { AdvertisementFacts, VerifiedAgencyProfile } from "@/server/generation/pipeline/types";

/**
 * CONTENT-AWARE FOOTER (Final Production UI Correction §4/§6).
 *
 * The trust footer used to be a fixed slab — clamp(250, W * 0.25, 300) —
 * sized for the maximum-content case, with its measured content block
 * vertically CENTRED inside it. For any agency whose profile was shorter
 * than that worst case the leftover height became symmetric dead space:
 * a large empty band above the agency name and another below the last
 * line. Centring never removed that space, it only split it in two.
 *
 * Two properties now hold, and both matter:
 *
 *   1. Height follows content. A two-line footer is materially shorter
 *      than a six-line one.
 *   2. The reservation equals the band. The fact layer reserves the
 *      strip and the Rendering Engine paints it; if the band were ever
 *      taller than the reservation it would paint over verified facts,
 *      which the Factual Integrity Law forbids.
 *
 * Tenant-neutral: every agency below is invented fixture data.
 */

const sparse: FooterContent = {
  agencyName: "Novara HR",
  registrationNumber: "B-0101/DEL/PER/1000+/5-2/9/1121/2011",
};

const rich: FooterContent = {
  agencyName: "Continental Overseas Manpower & Technical Consultancy Private Limited",
  registrationNumber: "B-9987/MUM/PER/1000+/4-1/4/7914/2007",
  officialEmail: "careers@continental-overseas.example",
  officialPhone: "+91 22 4000 1122",
  website: "www.continental-overseas.example",
  addressLine:
    "412 Harbour Point Business Park, Marine Lines East, Mumbai, Maharashtra 400002",
};

async function solid(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 12, g: 14, b: 22 } } })
    .png()
    .toBuffer();
}

/** Detects the trust band by scanning up from the bottom for KAI navy. */
async function bandTop(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let top = info.height;
  for (let y = info.height - 1; y >= 0; y--) {
    const i = (y * info.width + 4) * info.channels;
    const isNavy =
      Math.abs(data[i] - 0x0b) < 26 &&
      Math.abs(data[i + 1] - 0x1f) < 26 &&
      Math.abs(data[i + 2] - 0x33) < 30;
    if (!isNavy) break;
    top = y;
  }
  return top;
}

describe("Footer height follows its content", () => {
  it("a sparse profile gets a shorter strip than a rich one", () => {
    const w = 1080;
    const thin = brandingStripHeight(w, 1350, true, sparse);
    const thick = brandingStripHeight(w, 1350, true, rich);
    expect(thin).toBeLessThan(thick);
  });

  it("stacks the difference into real height when the canvas is too narrow for two columns", () => {
    // At a wide canvas the rich profile splits into two side-by-side
    // columns, so its extra fields cost width rather than height and the
    // two strips land within a few px of each other — correct, and the
    // reason the previous assertion here (a large height gap) was wrong.
    //
    // Force the compact single-column stack instead, where every extra
    // verified field genuinely is another line, and the height must
    // track it.
    const narrow = 420;
    const thin = brandingStripHeight(narrow, 1350, true, sparse);
    const thick = brandingStripHeight(narrow, 1350, true, rich);
    expect(thick - thin).toBeGreaterThan(20);
  });

  it("never returns the old fixed slab for a two-line footer", () => {
    // The defect: clamp(250, 1080 * 0.25, 300) = 270px for ANY content.
    expect(brandingStripHeight(1080, 1350, true, sparse)).toBeLessThan(250);
  });

  it("is bounded — it can neither collapse nor consume the advertisement", () => {
    const empty = brandingStripHeight(1080, 1350, true, {});
    expect(empty).toBeGreaterThanOrEqual(Math.round(1080 * 0.115));
    expect(brandingStripHeight(1080, 1350, true, rich)).toBeLessThanOrEqual(300);
  });

  it("grows for assets it must contain, even when the text is short", () => {
    const textOnly = brandingStripHeight(1080, 1350, true, sparse);
    const withQr = brandingStripHeight(1080, 1350, true, { ...sparse, hasQr: true });
    expect(withQr).toBeGreaterThan(textOnly);
  });

  it("falls back to the fixed slab when no content is supplied, never guessing smaller", () => {
    // A caller that cannot describe the footer must over-reserve, not
    // under-reserve: under-reserving is what paints over facts.
    expect(brandingStripHeight(1080, 1350, true)).toBe(270);
  });
});

describe("The reservation equals the band that paints it", () => {
  const profile = (over: Partial<VerifiedAgencyProfile> = {}): VerifiedAgencyProfile => ({
    agencyName: sparse.agencyName!,
    fullRegistrationNumber: sparse.registrationNumber,
    verificationStatus: "VERIFIED",
    ...over,
  });

  function facts(p: VerifiedAgencyProfile, n: number): AdvertisementFacts {
    return {
      header: "Urgent Requirement — Qatar",
      industry: "Oil & Gas",
      country: "Qatar",
      employer: null,
      positions: Array.from({ length: n }, (_, i) => ({ title: `Technician ${i + 1}`, count: i + 2 })),
      benefits: [{ label: "Food & Accommodation" }],
      interview: [],
      contact: { phone: "+91 90000 11111" },
      agencyProfile: p,
    };
  }

  for (const [label, n, over] of [
    ["minimal content", 1, {}],
    ["many vacancies", 18, {}],
    ["long agency name + full contact block", 4, {
      agencyName: rich.agencyName!,
      fullRegistrationNumber: rich.registrationNumber,
      officialEmail: rich.officialEmail,
      officialPhone: rich.officialPhone,
      website: rich.website,
      registeredAddress: rich.addressLine,
    }],
  ] as [string, number, Partial<VerifiedAgencyProfile>][]) {
    it(`${label}: the painted band never exceeds the reserved strip`, async () => {
      const p = profile(over);
      const f = facts(p, n);
      const base = await renderFactLayer({ facts: f, widthPx: 1080, heightPx: 1350 });

      const content: FooterContent = {
        agencyName: p.agencyName,
        registrationNumber: p.fullRegistrationNumber,
        officialEmail: p.officialEmail,
        officialPhone: p.officialPhone,
        website: p.website,
        addressLine: p.registeredAddress,
      };

      const reserved = brandingStripHeight(1080, base.heightPx, true, content);
      const painted = trustFooterHeight({
        imagePng: base.png,
        widthPx: 1080,
        heightPx: base.heightPx,
        ...content,
      });

      // Identical inputs must produce identical geometry.
      expect(painted).toBe(reserved);

      // And the fact layer must have left that strip empty, so the band
      // destroys nothing when it lands.
      const { data, info } = await sharp(base.png)
        .extract({ left: 0, top: base.heightPx - reserved, width: 1080, height: reserved })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let opaque = 0;
      for (let i = 3; i < data.length; i += info.channels) if (data[i] !== 0) opaque++;
      expect(opaque, `${label}: fact layer drew inside the reserved strip`).toBe(0);
    }, 60_000);
  }

  it("the drawn band lands exactly where the strip was reserved", async () => {
    const p = profile();
    const f = facts(p, 3);
    const base = await renderFactLayer({ facts: f, widthPx: 1080, heightPx: 1350 });
    const content: FooterContent = {
      agencyName: p.agencyName,
      registrationNumber: p.fullRegistrationNumber,
    };
    const composed = await applyBrandingOverlay({
      imagePng: base.png,
      widthPx: 1080,
      heightPx: base.heightPx,
      ...content,
    });
    const reserved = brandingStripHeight(1080, base.heightPx, true, content);
    const detectedTop = await bandTop(composed);
    // Within the 3px gold rule at the band's top edge.
    expect(Math.abs((base.heightPx - reserved) - detectedTop)).toBeLessThanOrEqual(4);
  }, 60_000);
});

describe("No dead space above the agency identity", () => {
  it("a sparse footer's content fills most of its band", async () => {
    const w = 1080;
    const h = 1200;
    const png = await applyBrandingOverlay({
      imagePng: await solid(w, h),
      widthPx: w,
      heightPx: h,
      ...sparse,
    });
    const top = await bandTop(png);
    const bandH = h - top;
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    let first = -1;
    let last = -1;
    for (let y = top + 6; y < h; y++) {
      let bright = false;
      for (let x = 40; x < Math.round(w * 0.7); x += 2) {
        const i = (y * info.width + x) * info.channels;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (lum > 200) {
          bright = true;
          break;
        }
      }
      if (bright) {
        if (first === -1) first = y;
        last = y;
      }
    }
    expect(first).toBeGreaterThan(-1);

    // Deliberate separation above the agency name — real, but bounded.
    const above = first - top;
    expect(above).toBeGreaterThan(6);
    expect(above).toBeLessThan(bandH * 0.4);
    // The old fixed slab left ~85px above a two-line block at this width.
    expect(above).toBeLessThan(70);

    // And the band closes shortly after the last line rather than
    // trailing off — the other half of the space centring used to split.
    const below = h - last;
    expect(below).toBeGreaterThan(4);
    expect(below).toBeLessThan(bandH * 0.4);
  }, 60_000);
});
