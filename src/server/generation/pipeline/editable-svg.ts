import sharp from "sharp";
import { renderFactLayer, type ThemeSelection } from "./fact-layer";
import { buildFooterBandMarkup, toPngDataUri } from "./branding-overlay";
import { selectFooterStyle, type FooterSelection } from "./footer-selection";
import { agencyAddressLine, agencyContactLine, applyAgencyBrand } from "../dna/agency-dna";
import { documentDna, type AdvertisementDocument } from "./advertisement-document";

/**
 * The Editable SVG assembler.
 *
 * Same engine, same facts, same Design DNA — a THIRD output format of the
 * one Rendering Engine, alongside the flattened PNG (`generate.ts`) and
 * the Advertisement JSON it is both drawn from. Nothing is drawn twice:
 * this reuses `renderFactLayer` and the branding band's exact drawing
 * code, and only changes what happens to the marks afterward — nested
 * into one live document instead of rasterized and flattened.
 *
 * The result is ONE `<svg>` document where:
 *   - the background artwork is the only raster content, sitting behind
 *     everything as a single `<image>`, replaceable by swapping its href
 *   - every heading, job title, salary, benefit, box, rule and divider is
 *     a real vector `<text>`/`<rect>`/`<path>` element — selectable and
 *     editable in any SVG tool (Illustrator, Figma, Inkscape, a browser)
 *   - the agency logo and the verification QR are `<image>` elements,
 *     replaceable the same way as the background
 *
 * `data-kai-field` attributes mark the editable regions so a purpose-built
 * editor can target them without parsing the whole document.
 */

export interface EditableSvgAssets {
  /** The background artwork. Omitted renders the facts on the DNA's own surface colour. */
  backgroundPng?: Buffer | null;
  agencyLogoPng?: Buffer | null;
  qrPng?: Buffer | null;
}

export interface EditableSvgResult {
  /** The complete, self-contained editable document. */
  svg: string;
  widthPx: number;
  heightPx: number;
  themeSelection: ThemeSelection;
  footerSelection: FooterSelection;
}

export async function buildEditableAdvertisementSvg(
  document: AdvertisementDocument,
  assets: EditableSvgAssets = {},
): Promise<EditableSvgResult> {
  const dna = documentDna(document);
  const { palette } = applyAgencyBrand(dna, document.agency);
  const { facts, format } = document;
  const W = format.widthPx;

  const factLayer = await renderFactLayer({
    facts,
    widthPx: W,
    heightPx: format.heightPx,
    dna,
    palette,
    printOrNewspaper: format.printOrNewspaper,
    dpi: format.dpi ?? undefined,
    ink: document.design.ink,
  });
  const H = factLayer.heightPx;

  // Footer style still answers to what the artwork actually looks like —
  // this samples the same flattened raster production would produce,
  // purely to make that one decision. The sample is discarded; it is
  // never the deliverable, and drawing it again is the existing
  // `selectFooterStyle` call, not a new one.
  const sampleBase = assets.backgroundPng
    ? sharp(assets.backgroundPng).resize(W, H, { fit: "cover" })
    : sharp({ create: { width: W, height: H, channels: 4, background: palette.surface } });
  const samplePng = await sampleBase.composite([{ input: factLayer.png, left: 0, top: 0 }]).png().toBuffer();
  const footerSelection = await selectFooterStyle(samplePng, document.design.footerStyle);

  const footer = await buildFooterBandMarkup({
    widthPx: W,
    heightPx: H,
    agencyLogoPng: assets.agencyLogoPng,
    qrPng: assets.qrPng,
    agencyName: document.agency.name,
    registrationNumber: document.agency.registrationNumber,
    contactLine: agencyContactLine(document.agency, facts.contact),
    addressLine: agencyAddressLine(document.agency),
    footerStyle: footerSelection.style,
    brandBadges: document.agency.badges,
    artworkHeightPx: factLayer.artworkHeightPx,
    singleInk: document.design.ink === "SINGLE_INK",
  });

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  ];

  // ---- Background artwork — the ONLY raster content, and the only
  // element a swap does not need to touch anything else for. `slice`
  // makes replacement forgiving: a differently-sized image still covers
  // the frame instead of leaving a gap. ----
  parts.push(
    `<defs><clipPath id="kai-canvas-clip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>`,
  );
  if (assets.backgroundPng) {
    // The image provider's declared MIME type is not trusted here: Gemini
    // has returned JPEG bytes under a "generate PNG" request before, and
    // an SVG rasterizer (unlike sharp's raster compositing, which reads
    // magic bytes and does not care) decodes a data URI strictly by its
    // declared type — a PNG label on JPEG bytes silently fails to decode,
    // leaving the artwork blank. Sniffing the real format is what makes
    // the embed correct regardless of what the provider claims.
    const bgFormat = (await sharp(assets.backgroundPng).metadata()).format ?? "png";
    const bgDataUri = `data:image/${bgFormat};base64,${assets.backgroundPng.toString("base64")}`;
    parts.push(
      `<g clip-path="url(#kai-canvas-clip)" data-kai-field="background">` +
        `<image id="kai-background-artwork" x="0" y="0" width="${W}" height="${H}" ` +
        `href="${bgDataUri}" preserveAspectRatio="xMidYMid slice"/></g>`,
    );
  } else {
    parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${palette.surface}" data-kai-field="background"/>`);
  }

  // ---- Every verified fact — vector, editable. ----
  parts.push(`<g data-kai-field="facts">${factLayer.svgMarkup}</g>`);

  // ---- Trust strip — logo, agency name, registration, contact, QR. ----
  if (footer) {
    parts.push(
      `<g data-kai-field="branding" transform="translate(0, ${H - footer.height})">${footer.markup}</g>`,
    );
  }

  parts.push(`</svg>`);

  return {
    svg: parts.join(""),
    widthPx: W,
    heightPx: H,
    themeSelection: factLayer.themeSelection,
    footerSelection,
  };
}

/** Rasterizes an editable document for KAI Audit (Vision QA) and PNG/PDF export. */
export async function rasterizeEditableSvg(svg: string, widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 300 }).resize(widthPx, heightPx).png().toBuffer();
}

// toPngDataUri stays imported here so a future caller embedding the logo
// or QR as a standalone top-level <image> (outside the branding band) has
// it available without reaching into branding-overlay.ts directly.
export { toPngDataUri };
