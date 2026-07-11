import { NextResponse, type NextRequest } from "next/server";
import { advertisementRepository } from "@/server/repositories/advertisement.repository";
import { exportImage, buildExportFilename, type ExportFormat } from "@/server/generation/image-export.service";
import { handleApiError, AppError, NotFoundError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";
import { getPlatformFormat } from "@/lib/platform-formats";

const VALID_FORMATS: ExportFormat[] = ["png", "jpg", "pdf"];

/**
 * GET /api/advertisements/[id]/export?format=png|jpg|pdf
 *
 * QR Quality gate (Sprint 005): "Before downloadable status: QR must
 * decode successfully. Trust check must pass... Never export a
 * knowingly broken verification QR." Both are already computed and
 * stored at generation time (trustStatus); this route re-checks them
 * before allowing a download rather than trusting a stale client state.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAgencyMember("advertisement:view");
    const { id } = await params;

    const format = request.nextUrl.searchParams.get("format") as ExportFormat | null;
    if (!format || !VALID_FORMATS.includes(format)) {
      throw new AppError("format must be one of: png, jpg, pdf", 400);
    }

    const advertisement = await advertisementRepository.findById(id, user.agencyId);
    if (!advertisement) throw new NotFoundError("Advertisement");

    if (!advertisement.generatedAssetUrl) {
      throw new AppError("Generate the advertisement before downloading it.", 409, "NOT_GENERATED");
    }
    if (advertisement.trustStatus === "BLOCKED") {
      throw new AppError(
        "This advertisement is blocked by the trust check and cannot be downloaded until it's fixed and regenerated.",
        409,
        "TRUST_BLOCKED",
      );
    }

    const base64 = advertisement.generatedAssetUrl.split(",")[1];
    if (!base64) {
      throw new AppError("This advertisement's generated asset is invalid — regenerate it.", 500);
    }
    const pngBuffer = Buffer.from(base64, "base64");

    const platformFormat = getPlatformFormat(advertisement.platformFormat);
    const { buffer, mimeType } = await exportImage(pngBuffer, format, {
      widthPx: platformFormat.widthPx,
      heightPx: platformFormat.heightPx,
    });

    const positions = advertisement.positions as unknown as { title: string }[];
    const filename = buildExportFilename({
      country: advertisement.country,
      industry: advertisement.industry,
      firstPositionTitle: positions[0]?.title,
      format,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
