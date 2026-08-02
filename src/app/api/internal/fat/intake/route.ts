import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUser } from "@/lib/session";
import { assertPermission } from "@/lib/rbac";
import { handleApiError, AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { fatValidationService } from "@/server/services/fat-validation.service";
import type { RequirementSourceInput } from "@/server/ai/requirement-source.service";

const log = createLogger("api:internal:fat:intake");

/** The seven channels Task 006.5 exposes. A strict subset of what Requirement Intelligence (Task 002) actually supports. */
const TEXT_KINDS = new Set(["WHATSAPP_TEXT", "PLAIN_TEXT"]);
const URL_KINDS = new Set(["WEBSITE", "GOOGLE_SHEET"]);
const FILE_KINDS: Record<string, string> = {
  PDF: "application/pdf",
  WORD: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  IMAGE: "image/png",
  EXCEL: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * POST /api/internal/fat/intake — Task 006.5, the Founder validation
 * bridge's one endpoint.
 *
 * Internal only: KAI_SUPER_ADMIN, nobody else. Accepts multipart/form-data
 * with one of `text` (pasted WhatsApp/plain text), `url` (public website
 * or Google Sheet), or `file` (PDF/Word/Image/Excel), plus a `kind` field
 * naming which. Runs the source through the unmodified locked pipeline
 * (Requirement -> JobOrder -> JobOrder Intelligence -> Compliance ->
 * Campaign -> Layout Intelligence) via fatValidationService, and returns
 * the complete canonical JSON. No rendering, no advertisement, no image
 * is produced or returned.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    assertPermission(user, "fat:access");

    const formData = await request.formData();
    const kind = String(formData.get("kind") ?? "");
    const label = formData.get("label");

    let source: RequirementSourceInput;

    if (TEXT_KINDS.has(kind)) {
      const text = formData.get("text");
      if (typeof text !== "string" || text.trim().length === 0) {
        throw new AppError("Paste some text before running.", 400, "MISSING_TEXT");
      }
      source = {
        kind: kind as "WHATSAPP_TEXT" | "PLAIN_TEXT",
        text,
        ...(typeof label === "string" && label ? { label } : {}),
      };
    } else if (URL_KINDS.has(kind)) {
      const url = formData.get("url");
      if (typeof url !== "string" || url.trim().length === 0) {
        throw new AppError("Provide a public URL before running.", 400, "MISSING_URL");
      }
      source = {
        kind: kind as "WEBSITE" | "GOOGLE_SHEET",
        url,
        ...(typeof label === "string" && label ? { label } : {}),
      };
    } else if (kind in FILE_KINDS) {
      const file = formData.get("file");
      if (!(file instanceof File)) {
        throw new AppError("Upload a file before running.", 400, "MISSING_FILE");
      }
      const arrayBuffer = await file.arrayBuffer();
      source = {
        kind: kind as "PDF" | "WORD" | "IMAGE" | "EXCEL",
        data: Buffer.from(arrayBuffer),
        mimeType: file.type || FILE_KINDS[kind],
        fileName: file.name,
        ...(typeof label === "string" && label ? { label } : {}),
      };
    } else {
      throw new AppError(
        `Unknown intake kind "${kind}". Expected one of WHATSAPP_TEXT, PLAIN_TEXT, PDF, WORD, IMAGE, EXCEL, GOOGLE_SHEET, WEBSITE.`,
        400,
        "UNKNOWN_KIND",
      );
    }

    const snapshot = await fatValidationService.runIntake({
      actorId: user.id,
      inputType: kind,
      sources: [source],
    });

    return NextResponse.json({ data: snapshot }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "FAT intake failed");
    return handleApiError(error);
  }
}
