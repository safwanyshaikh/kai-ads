import sharp from "sharp";

/**
 * ARTWORK CANVAS TREATMENT — the two operations every KAI advertisement
 * applies to the image model's output before the deterministic fact
 * layer is composited over it.
 *
 * These lived in generate.ts, which is also where the single-image
 * pipeline runs. The carousel path must apply the SAME treatment — a
 * slide is not allowed to crop Gemini's frame when a single image would
 * not — but generate.ts imports the carousel renderer, so importing back
 * the other way would be a cycle. They live here so there is exactly one
 * implementation for both paths to share, not two that can drift.
 *
 * generate.ts re-exports extendCanvasHeight for its existing callers.
 */

export async function extendCanvasHeight(
  image: Buffer,
  widthPx: number,
  targetHeightPx: number,
): Promise<Buffer> {
  const metadata = await sharp(image).metadata();
  const sourceHeight = metadata.height ?? targetHeightPx;
  const extra = targetHeightPx - sourceHeight;
  if (extra <= 0) return image;

  const { data } = await sharp(image)
    .extract({ left: 0, top: Math.max(0, sourceHeight - 1), width: widthPx, height: 1 })
    .resize(1, 1, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const r = data[0] ?? 20;
  const g = data[1] ?? 20;
  const b = data[2] ?? 20;

  return sharp(image)
    .extend({ bottom: extra, background: { r, g, b } })
    .png()
    .toBuffer();
}

/* ========================================================================== */
/* IMAGE NORMALISATION                                                         */
/* ========================================================================== */

/**
 * Preserve the complete Gemini composition.
 *
 * Gemini image:
 *       ↓
 * complete image preserved
 *       ↓
 * publication dimensions
 *
 * Never:
 *
 * Gemini image
 *       ↓
 * destructive crop
 */
export async function fitWithoutCropping(
  image: Buffer,
  widthPx: number,
  heightPx: number,
): Promise<Buffer> {
  const metadata =
    await sharp(
      image,
    ).metadata();

  const sourceWidth =
    metadata.width ??
    widthPx;

  const sourceHeight =
    metadata.height ??
    heightPx;

  const scale =
    Math.min(
      widthPx /
        sourceWidth,

      heightPx /
        sourceHeight,
    );

  const fittedWidth =
    Math.max(
      1,
      Math.round(
        sourceWidth *
          scale,
      ),
    );

  const fittedHeight =
    Math.max(
      1,
      Math.round(
        sourceHeight *
          scale,
      ),
    );

  /**
   * Exact match.
   */
  if (
    fittedWidth ===
      widthPx &&
    fittedHeight ===
      heightPx
  ) {
    return sharp(
      image,
    )
      .resize(
        widthPx,
        heightPx,
        {
          fit: "inside",
          withoutEnlargement:
            false,
        },
      )
      .png()
      .toBuffer();
  }

  /**
   * Resize the entire image.
   */
  const fitted =
    await sharp(
      image,
    )
      .resize(
        fittedWidth,
        fittedHeight,
        {
          fit: "inside",
          withoutEnlargement:
            false,
        },
      )
      .png()
      .toBuffer();

  /**
   * Extract a representative colour for the tiny
   * unavoidable extension.
   */
  const {
    data,
  } =
    await sharp(
      fitted,
    )
      .resize(
        1,
        1,
        {
          fit: "cover",
        },
      )
      .removeAlpha()
      .raw()
      .toBuffer({
        resolveWithObject:
          true,
      });

  const r =
    data[0] ?? 20;

  const g =
    data[1] ?? 20;

  const b =
    data[2] ?? 20;

  return sharp({
    create: {
      width:
        widthPx,

      height:
        heightPx,

      channels: 3,

      background: {
        r,
        g,
        b,
      },
    },
  })
    .composite([
      {
        input:
          fitted,

        left:
          Math.round(
            (
              widthPx -
              fittedWidth
            ) / 2,
          ),

        top:
          Math.round(
            (
              heightPx -
              fittedHeight
            ) / 2,
          ),
      },
    ])
    .png()
    .toBuffer();
}
