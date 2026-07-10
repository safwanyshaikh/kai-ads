import { NextResponse, type NextRequest } from "next/server";
import { storageService, InvalidFileError } from "@/server/services/storage.service";
import { handleApiError, AppError } from "@/lib/errors";
import { requireAgencyMember } from "@/lib/session";
import { enforceRateLimit } from "@/server/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:uploads:advertisement-source");

/**
 * POST /api/uploads/advertisement-source — multipart/form-data, field "file".
 * Create Advertisement: Upload PDF / DOCX / Image / WhatsApp Screenshot.
 * Authenticated (unlike the logo upload, which runs pre-registration).
 */
export async function POST(request: NextRequest) {
  try {
    await requireAgencyMember("advertisement:create");
    await enforceRateLimit(request, "uploads:advertisement-source", RATE_LIMITS.advertisementSourceUpload);

    if (!storageService.isConfigured) {
      throw new AppError(
        "File storage is not configured yet. Set STORAGE_PROVIDER and its credentials.",
        503,
        "STORAGE_NOT_CONFIGURED",
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("No file was provided.", 400, "MISSING_FILE");
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await storageService.uploadAdvertisementSource({
      name: file.name,
      type: file.type,
      data: Buffer.from(arrayBuffer),
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidFileError) {
      log.warn({ err: error }, "Rejected invalid advertisement source upload");
    }
    return handleApiError(error);
  }
}
