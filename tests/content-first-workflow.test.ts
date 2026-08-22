import { describe, expect, it } from "vitest";

import {
  conflictsResolved,
  detectContentConflicts,
  type ContentConflict,
} from "@/server/services/content-conflict.service";
import {
  dtpVariantFor,
  isDtpOutput,
  renderDtpAdvertisement,
} from "@/server/services/dtp-render.service";
import {
  DTP_AD_HEIGHTS_CM,
  DTP_QR_MIN_CM,
  DtpBookingTooSmallError,
  selectDtpBooking,
  type DtpAdvertisement,
} from "@/server/generation/dtp";
import { DTP_DEFAULT_DPI, pxToCm } from "@/lib/dtp-format-law";
import {
  DTP_TYPE,
  dtpFamily,
  dtpSize,
  dtpTextWidth,
  type DtpToken,
} from "@/server/generation/dtp";
import { BrandIdentityViolationError, brandAsset } from "@/lib/brand-identity";

/** A real PNG, so intrinsic-size reading has something to read. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAASwAAAC+CAIAAAAAxqXeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABn0lEQVR42u3T" +
    "MQ0AAAgEsdeACsTgXw8TGliaVMEll+oBHkUCMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGY" +
    "EDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAwIZgQMCGYEDAhmBAw" +
    "IZgQMCGYEDAhmBBMqAKYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwI" +
    "mBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCJgQTAiYEEwImBBMCCZU" +
    "AUwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRM" +
    "CCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYETAgmBEwIJgRMCCYEzgLT+pK9kfJL8wAAAABJ" +
    "RU5ErkJggg==",
  "base64",
);

/**
 * CONTENT-FIRST WORKFLOW.
 *
 * The architecture these cover is: source intake -> content
 * intelligence -> conflict detection -> tenant approval -> output
 * selection -> the matching rendering engine. The two properties worth
 * defending are that facts are never settled behind the tenant's back,
 * and that nothing is rendered until they have approved.
 */
describe("content conflicts — sources disagreeing is the tenant's decision", () => {
  it("reports a disagreement between a document and typed text", () => {
    const conflicts = detectContentConflicts(
      { salary: "SAR 1,300", country: "Saudi Arabia" },
      { salary: "SAR 1,400", country: "Saudi Arabia" },
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe("salary");
    expect(conflicts[0].candidates.map((c) => c.source)).toEqual(["DOCUMENT", "FREE_TEXT"]);
    expect(conflicts[0].candidates.map((c) => c.value)).toEqual(["SAR 1,300", "SAR 1,400"]);
  });

  it("does not manufacture a conflict from formatting", () => {
    // Prompting about "SAR 1,300" vs "SAR 1300" would train the tenant
    // to click through conflict screens without reading them, which is
    // worse than detecting nothing at all.
    expect(detectContentConflicts({ salary: "SAR 1,300" }, { salary: "SAR 1300" })).toEqual([]);
    expect(detectContentConflicts({ salary: "SAR 1,300" }, { salary: "sar 1,300 " })).toEqual([]);
  });

  it("treats a fact only one source mentions as no conflict", () => {
    expect(detectContentConflicts({ salary: "SAR 1,300" }, {})).toEqual([]);
    expect(detectContentConflicts({}, { interviewDate: "26 March" })).toEqual([]);
    expect(detectContentConflicts({ salary: "" }, { salary: "SAR 1,400" })).toEqual([]);
  });

  it("catches every fact class worth adjudicating", () => {
    const conflicts = detectContentConflicts(
      {
        salary: "SAR 1300", interviewDate: "26 March", interviewLocation: "Mumbai",
        contactPhone: "8655960411", contactEmail: "a@example.test", clientName: "Masco",
      },
      {
        salary: "SAR 1400", interviewDate: "28 March", interviewLocation: "Chennai",
        contactPhone: "8655960413", contactEmail: "b@example.test", clientName: "Exact",
      },
    );
    expect(conflicts.map((c) => c.field).sort()).toEqual([
      "clientName", "contactEmail", "contactPhone",
      "interviewDate", "interviewLocation", "salary",
    ]);
  });

  it("accepts a resolution the tenant typed themselves", () => {
    // Both sources can be out of date; the gate asks that the tenant
    // decided, not that they picked one of the two offered values.
    const conflicts: ContentConflict[] = [{
      field: "salary", label: "Salary",
      candidates: [
        { value: "SAR 1,300", source: "DOCUMENT" },
        { value: "SAR 1,400", source: "FREE_TEXT" },
      ],
    }];
    expect(conflictsResolved(conflicts, { salary: "SAR 1,350" })).toBe(true);
    expect(conflictsResolved(conflicts, { salary: "SAR 1,300" })).toBe(true);
    expect(conflictsResolved(conflicts, {})).toBe(false);
    expect(conflictsResolved([], {})).toBe(true);
  });
});

describe("DTP booking — the content decides the purchased size", () => {
  const tenant = { name: "Novara HR", registrationText: "B-0101/MUM/PART/1000+/9986/2022" };

  it("takes the smallest height that carries the content", () => {
    const sparse = selectDtpBooking({
      ad: {
        headline: "Qatar", tenant, contactPhone: "8104962797",
        positions: [{ title: "Electrician", count: 6 }],
      },
    });
    expect(sparse.heightCm).toBe(5);
    expect(sparse.widthCm).toBe(6);
  });

  it("grows the booking rather than compressing the trades", () => {
    // Eight trades with benefits technically fit a 6x6 by shrinking
    // every trade name to the legibility floor. That is overcrowding
    // sold as efficiency, so the selector keeps looking.
    const dense: DtpAdvertisement = {
      headline: "Saudi Arabia", subhead: "Catering", tenant, contactPhone: "8104962797",
      positions: Array.from({ length: 8 }, (_, i) => ({ title: `Chef Grade ${i + 1}`, count: i + 2 })),
      salary: "SR 1500 – 3000", benefits: ["Food", "Accommodation", "Transport", "Medical"],
      eligibility: ["3 years experience"], interview: "Mumbai 2-3 Sep",
    };
    const booking = selectDtpBooking({ ad: dense });
    expect(booking.heightCm).toBeGreaterThan(6);
    expect(booking.compressed).toBe(false);
  });

  it("reports which heights it refused, and why", () => {
    const booking = selectDtpBooking({
      ad: {
        headline: "Saudi Arabia", tenant, contactPhone: "8104962797",
        positions: Array.from({ length: 20 }, (_, i) => ({ title: `Technician Grade ${i + 1}`, count: i + 1 })),
      },
    });
    expect(booking.rejected.length).toBeGreaterThan(0);
    expect(booking.rejected[0].heightCm).toBe(5);
    expect(booking.rejected[0].unplaced.length).toBeGreaterThan(0);
  });

  it("never returns a size outside the approved family", () => {
    for (const count of [1, 3, 6, 10, 16]) {
      const booking = selectDtpBooking({
        ad: {
          headline: "Oman", tenant, contactPhone: "8104962797",
          positions: Array.from({ length: count }, (_, i) => ({ title: `Trade ${i + 1}`, count: i + 1 })),
        },
      });
      expect(booking.widthCm).toBe(6);
      expect(booking.heightCm).toBeGreaterThanOrEqual(5);
      expect(booking.heightCm).toBeLessThanOrEqual(12);
      // 56 was a misread of a booking slip, never a size.
      expect(booking.heightCm).not.toBe(56);
    }
  });

  it("refuses the whole family rather than dropping facts", () => {
    expect(() => selectDtpBooking({
      ad: {
        headline: "Saudi Arabia", tenant, contactPhone: "8104962797",
        positions: Array.from({ length: 90 }, (_, i) => ({
          title: `Technician Grade ${i + 1}`, detail: "Upto SR 2000 + SR 300 Food",
        })),
      },
    })).toThrow(DtpBookingTooSmallError);
  });
});

describe("DTP rendering — no image model, and identities kept apart", () => {
  const base: DtpAdvertisement = {
    headline: "Saudi Arabia",
    tenant: { name: "Novara HR", registrationText: "B-0101/MUM/PART/1000+/9986/2022" },
    positions: [{ title: "Pipe Fabricator", detail: "Upto SR 2000 + SR 300 Food" }],
    contactPhone: "8104962797",
  };

  it("maps the two DTP modes and excludes Social", () => {
    expect(isDtpOutput("DTP_BW")).toBe(true);
    expect(isDtpOutput("DTP_COLOUR")).toBe(true);
    expect(isDtpOutput("SOCIAL")).toBe(false);
    expect(dtpVariantFor("DTP_BW")).toBe("BW");
    expect(dtpVariantFor("DTP_COLOUR")).toBe("COLOUR");
  });

  it("composes deterministically, with no image generation", () => {
    const result = renderDtpAdvertisement({ outputType: "DTP_BW", ad: base });
    expect(result.usedImageGeneration).toBe(false);
    expect(result.render.svg).toContain("<svg");
    // Same input, same output — a compositor, not a sampler.
    const again = renderDtpAdvertisement({ outputType: "DTP_BW", ad: base });
    expect(again.render.svg).toBe(result.render.svg);
    expect(again.heightCm).toBe(result.heightCm);
  });

  it("sets a Black & White booking in ink whatever accent is supplied", () => {
    const result = renderDtpAdvertisement({
      outputType: "DTP_BW", ad: { ...base, accent: "#B3121D" },
    });
    expect(result.render.svg).not.toContain("#B3121D");
    expect(renderDtpAdvertisement({
      outputType: "DTP_COLOUR", ad: { ...base, accent: "#B3121D" },
    }).render.svg).toContain("#B3121D");
  });

  it("places a tenant-supplied client logo, and only in the client slot", () => {
    const withClient = renderDtpAdvertisement({
      outputType: "DTP_COLOUR",
      ad: { ...base, client: { name: "Al Rashid Group" } },
      clientLogoPng: PNG,
    });
    expect(withClient.render.svg).toContain("<image");
  });

  it("does not substitute the agency's mark when no client logo was supplied", () => {
    // An absent client logo is absent. Filling the slot with whatever
    // mark is to hand credits the wrong company.
    const result = renderDtpAdvertisement({
      outputType: "DTP_COLOUR",
      ad: { ...base, client: { name: "Al Rashid Group" } },
      tenantLogoPng: PNG,
    });
    const images = [...result.render.svg.matchAll(/<image/g)];
    expect(images).toHaveLength(1); // the tenant's own, in the footer
  });

  it("refuses a client mark placed in the tenant slot", () => {
    expect(() => renderDtpAdvertisement({
      outputType: "DTP_COLOUR",
      ad: {
        ...base,
        tenant: { ...base.tenant, logo: brandAsset("CLIENT_LOGO", PNG) as never },
      },
    })).toThrow(BrandIdentityViolationError);
  });
});

/**
 * KAI VERIFICATION QR.
 *
 * KAI's own trust mark, structurally separate from the tenant's logo,
 * the client's logo and any certification badge. It is the reader's
 * route to the licence check, so it is reserved into the footer's
 * physical layout rather than laid over it, and it is held to a
 * physical minimum size instead of shrinking with the booking.
 */
describe("DTP verification QR — KAI's trust mark, not anyone else's", () => {
  const ad: DtpAdvertisement = {
    headline: "Saudi Arabia",
    tenant: {
      name: "Northgate Overseas Manpower",
      registrationText: "B-0417/MUM/PART/1000+/4820/2021",
    },
    positions: [
      { title: "HVAC Technician", count: 45, qualifier: "Diploma, 5 years" },
      { title: "Project Manager", count: 5, qualifier: "PMP, 15 years" },
    ],
    contactPhone: "8104962797",
    contactEmail: "jobs@example-agency.test",
  };
  // Long enough to fill the column. Short footer lines never reach the
  // QR at all, so they cannot demonstrate that the text column is
  // actually narrowed for it — an earlier version of this fixture
  // wrapped to 518px against a QR edge at 542 and passed whether the
  // narrowing was there or not.
  const addressLines = [
    "Northgate House 2nd Floor Andheri Kurla Road Andheri East Mumbai 400059 Maharashtra India",
  ];

  /** Real QR pixels, so what is measured is what would print. */
  async function realQr(url: string): Promise<Buffer> {
    const { generateAndVerifyQr } = await import("@/server/generation/qr-renderer");
    const result = await generateAndVerifyQr(url);
    expect(result.decodable).toBe(true);
    return result.png;
  }

  const URL = "https://kai-ads.test/v/ver_9f3c21?a=ad_7781";

  /** A token per family, so advances are measured with the right metrics. */
  const TOKEN_BY_FAMILY = new Map(
    (Object.keys(DTP_TYPE) as DtpToken[]).map((t) => [dtpFamily(t), t]),
  );

  it("prints the QR at every bookable size when the tenant is verified", async () => {
    const qr = await realQr(URL);
    for (const heightCm of DTP_AD_HEIGHTS_CM) {
      const { render } = renderDtpAdvertisement({
        ad, heightCm, outputType: "DTP_BW", verificationQrPng: qr, addressLines,
      });
      expect(render.svg).toContain("<image");
    }
  });

  it("reserves nothing when the tenant has no verification", () => {
    // No placeholder, no empty box — an unverified agency simply has no
    // trust mark, and the footer is measured accordingly.
    const { render } = renderDtpAdvertisement({
      ad, heightCm: 8, outputType: "DTP_BW", addressLines,
    });
    expect(render.svg).not.toContain("<image");
  });

  it("holds the QR to a scannable physical size, whatever the booking", async () => {
    const qr = await realQr(URL);
    for (const heightCm of DTP_AD_HEIGHTS_CM) {
      const { render } = renderDtpAdvertisement({
        ad, heightCm, outputType: "DTP_BW", verificationQrPng: qr, addressLines,
      });
      const box = /<image[^>]*width="(\d+)" height="(\d+)"/.exec(render.svg);
      expect(box).toBeTruthy();
      const [, w, h] = box as RegExpExecArray;
      // Square — never cropped or stretched.
      expect(Number(w)).toBe(Number(h));
      expect(pxToCm(Number(w), DTP_DEFAULT_DPI)).toBeGreaterThanOrEqual(DTP_QR_MIN_CM - 0.01);
    }
  });

  it("keeps the QR inside the advertisement and clear of the footer text", async () => {
    const qr = await realQr(URL);
    for (const heightCm of DTP_AD_HEIGHTS_CM) {
      const { render } = renderDtpAdvertisement({
        ad, heightCm, outputType: "DTP_COLOUR", verificationQrPng: qr, addressLines,
      });
      const m = /<image[^>]*x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/.exec(render.svg);
      const [, xs, ys, ws, hs] = m as RegExpExecArray;
      const x = Number(xs), y = Number(ys), w = Number(ws), h = Number(hs);

      expect(x + w).toBeLessThanOrEqual(render.widthPx);
      expect(y + h).toBeLessThanOrEqual(render.heightPx);

      // Nothing is set underneath it. Measured on where footer text
      // ENDS, not where it starts: a line beginning left of the QR can
      // still run clean through it, and an earlier version of this
      // check asked the wrong question and passed while it did.
      const rows = [...render.svg.matchAll(
        /<text[^>]*x="(-?\d+)" y="(-?\d+)"[^>]*font-family="([^"]+)"[^>]*font-size="(\d+)"[^>]*(?:text-anchor="([a-z]+)" )?[^>]*>([^<]*)<\/text>/g,
      )].map(([, tx, ty, family, size, anchor, content]) => ({
        x: Number(tx), y: Number(ty), family, size: Number(size),
        anchor: anchor ?? "start",
        content: content.replace(/&amp;/g, "&"),
      }));

      for (const row of rows) {
        if (!row.content.trim()) continue;
        if (row.anchor !== "start") continue; // centred/right-set lines sit elsewhere
        if (row.y <= y || row.y >= y + h) continue; // not on the QR's band

        const token = TOKEN_BY_FAMILY.get(row.family);
        if (!token) continue;
        const advance = dtpTextWidth(row.content, token, render.widthPx)
          * row.size / dtpSize(token, render.widthPx);
        expect(`${row.content} ends @${Math.round(row.x + advance)}`)
          .toBe(`${row.content} ends @${Math.round(Math.min(row.x + advance, x))}`);
      }
    }
  });

  it("decodes out of the FINAL rendered artwork, not just the source PNG", async () => {
    // The claim that matters is that a phone can read it off the
    // printed page, so this rasterises the whole advertisement and
    // scans the QR back out of the finished image.
    const qr = await realQr(URL);
    const sharp = (await import("sharp")).default;
    const { PNG } = await import("pngjs");
    const jsQR = (await import("jsqr")).default;

    for (const heightCm of [5, 12] as const) {
      for (const outputType of ["DTP_BW", "DTP_COLOUR"] as const) {
        const { render } = renderDtpAdvertisement({
          ad, heightCm, outputType, verificationQrPng: qr, addressLines,
        });
        const raster = await sharp(Buffer.from(render.svg)).png().toBuffer();
        const decoded = PNG.sync.read(raster);
        const found = jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height);
        expect(found?.data).toBe(URL);
      }
    }
  }, 30_000);

  it("refuses a tenant or client mark in the verification slot", async () => {
    const qr = await realQr(URL);
    for (const role of ["TENANT_PRIMARY_LOGO", "CLIENT_LOGO"] as const) {
      expect(() => renderDtpAdvertisement({
        ad: { ...ad, verificationQr: brandAsset(role, qr) as never },
        heightCm: 8, outputType: "DTP_BW", addressLines,
      })).toThrow(BrandIdentityViolationError);
    }
  });
});
