import { NextResponse, type NextRequest } from "next/server";
import { requireFounder } from "@/server/fat/guard";
import { storageService, InvalidFileError } from "@/server/services/storage.service";
import { handleApiError, AppError } from "@/lib/errors";

/**
 * Task 006.5 — POST /api/internal/fat/upload — file upload for the FAT
 * console. A thin, founder-gated wrapper around the exact same
 * storageService.uploadAdvertisementSource used by Task 002's
 * /api/uploads/advertisement-source; that route itself requires
 * requireAgencyMember, which the Founder's account cannot pass (see
 * guard.ts), so this route exists only to change WHO may call the
 * unmodified underlying function, not WHAT it does.
 */
export async function POST(request: NextRequest) {
  try {
    await requireFounder();

    if (!storageService.isConfigured) {
      throw new AppError(
        "File storage is not configured for this environment. Set STORAGE_PROVIDER and its credentials to enable PDF/DOCX/Image upload on this Preview.",
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
      return handleApiError(new AppError(error.message, 400, "INVALID_FILE"));
    }
    return handleApiError(error);
  }
}
