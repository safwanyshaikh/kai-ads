import type { AdvertisementFacts } from "./types";

/**
 * ============================================================================
 * KAI FACT LAYER
 * ============================================================================
 *
 * IMPORTANT ARCHITECTURE CHANGE
 *
 * Gemini owns the COMPLETE advertisement composition:
 *
 *   - campaign headline
 *   - destination
 *   - industry
 *   - hero visual
 *   - recruitment information
 *   - role grouping
 *   - benefits
 *   - interview presentation
 *   - candidate CTA
 *   - typography
 *   - visual hierarchy
 *   - footer composition
 *
 * KAI owns factual integrity and trust verification.
 *
 * Therefore this layer MUST NOT draw recruitment content onto the image.
 *
 * The old implementation rendered:
 *
 *   - headline
 *   - employer
 *   - country
 *   - industry
 *   - vacancy count
 *   - positions
 *   - benefits
 *   - interview
 *
 * That created the "image + CRM spreadsheet overlay" problem.
 *
 * This implementation is intentionally a pass-through compatibility layer.
 *
 * Why keep the file?
 *
 * Existing pipeline callers may still call renderFactLayer().
 * We preserve that contract while removing its ability to redraw the ad.
 *
 * The actual controlled trust layer is handled by:
 *
 *   branding-overlay.ts
 *
 * which owns only exact agency identity / QR / verification information.
 * ============================================================================
 */

export class LayoutCapacityError extends Error {
  readonly code =
    "LAYOUT_CAPACITY";

  constructor(
    readonly unplaced: string[],
  ) {
    super(
      unplaced.length > 0
        ? `Advertisement layout capacity check failed: ${unplaced.join("; ")}`
        : "Advertisement layout capacity check failed.",
    );

    this.name =
      "LayoutCapacityError";
  }
}

export interface FactLayerInput {
  facts: AdvertisementFacts;
  widthPx: number;
  heightPx: number;
}

export interface FactLayerResult {
  /**
   * The image is returned unchanged.
   *
   * Gemini already created the complete advertisement.
   */
  png: Buffer;

  /**
   * Original image height.
   */
  heightPx: number;

  /**
   * Complete artwork height.
   */
  artworkHeightPx: number;
}

/**
 * ============================================================================
 * renderFactLayer
 * ============================================================================
 *
 * Backward-compatible pipeline entry point.
 *
 * There is NO SVG.
 * There is NO text overlay.
 * There is NO role grid.
 * There is NO vacancy badge.
 * There is NO deterministic campaign header.
 *
 * The image received here is already the advertisement.
 */
export async function renderFactLayer(
  input: FactLayerInput,
): Promise<FactLayerResult> {
  void input.facts;

  return {
    png: inputImageBuffer(input),

    heightPx:
      input.heightPx,

    artworkHeightPx:
      input.heightPx,
  };
}

/**
 * Keeps the implementation explicit and easy to audit.
 *
 * The input image is expected to be supplied through the pipeline's
 * existing image buffer field. Type compatibility is preserved below
 * without introducing a second renderer.
 */
function inputImageBuffer(
  input: FactLayerInput,
): Buffer {
  /**
   * This compatibility function intentionally expects the pipeline to
   * extend FactLayerInput with its current raster buffer at runtime.
   *
   * The existing generation pipeline historically attached `png` to the
   * render input object.
   */
  const candidate =
    input as FactLayerInput & {
      png?: Buffer;
      imagePng?: Buffer;
    };

  if (Buffer.isBuffer(candidate.png)) {
    return candidate.png;
  }

  if (
    Buffer.isBuffer(
      candidate.imagePng,
    )
  ) {
    return candidate.imagePng;
  }

  throw new Error(
    "KAI Fact Layer received no image buffer. Gemini output must be passed through the pipeline before fact-layer compatibility execution.",
  );
}

/**
 * ============================================================================
 * LEGACY COMPATIBILITY HELPERS
 * ============================================================================
 *
 * These functions are retained only because older pipeline code/tests may
 * import them.
 *
 * They MUST NOT be used to create a recruitment overlay.
 *
 * The trust/footer layer is independently owned by branding-overlay.ts.
 * ============================================================================
 */

/**
 * No deterministic branding strip belongs to the Fact Layer anymore.
 *
 * Returns zero because fact-layer no longer reserves a content panel.
 */
export function brandingStripHeight(
  _widthPx: number,
  _heightPx: number,
  _hasContactLine: boolean,
): number {
  return 0;
}

/**
 * No contact row is rendered here.
 */
export function brandingContactRowHeight(
  _widthPx: number,
  _heightPx: number,
  _hasContactLine: boolean,
): number {
  return 0;
}

/**
 * No fixed factual band is reserved.
 */
export function brandingBandHeight(
  _widthPx: number,
  _heightPx: number,
): number {
  return 0;
}

/**
 * No advertisement content is deterministically rendered.
 */
export const BRANDING_RESERVED_HEIGHT_PCT =
  0;

/**
 * ============================================================================
 * AUDIT GUARD
 * ============================================================================
 *
 * This function exists purely for tests / future certification.
 *
 * It makes the architectural rule explicit:
 *
 * "The Fact Layer never owns visual advertisement composition."
 */
export function factLayerOwnsComposition(): false {
  return false;
}

/**
 * Recruitment information remains available to the intelligence/QA layers
 * because this layer does NOT mutate or discard the source facts.
 */
export function preserveFacts(
  facts: AdvertisementFacts,
): AdvertisementFacts {
  return facts;
}
