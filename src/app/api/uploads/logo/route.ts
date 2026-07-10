import { NextResponse, type NextRequest } from "next/server";
import { storageService, InvalidFileError } from "@/server/services/storage.service";
import { handleApiError, AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { enforceRateLimit } from "@/server/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";

const log = createLogger("api:uploads:logo");

/**
 * POST /api/uploads/logo — multipart/form-data with field "file".
 * Public (used during agency registration, before an account exists).
 * Rate limited per IP. Returns the storage URL to embed in the
 * registration payload.
 */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "uploads:logo", RATE_LIMITS.logoUpload);

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
    const result = await storageService.uploadAgencyLogo({
      name: file.name,
      type: file.type,
      data: Buffer.from(arrayBuffer),
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidFileError) {
      log.warn({ err: error }, "Rejected invalid logo upload");
    }
    return handleApiError(error);
  }
}
