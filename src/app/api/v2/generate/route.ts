import { NextResponse, type NextRequest } from "next/server";
import { generateAdvertisementV2 } from "@/server/generation-v2/generate";
import { generateAndVerifyQr, buildQrTrackingUrl } from "@/server/generation/qr-renderer";
import { requireAgencyMember } from "@/lib/session";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { handleApiError, AppError } from "@/lib/errors";

/**
 * POST /api/v2/generate — KAI Ads V2. Recruiter text in, one image out.
 * Body: { text: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAgencyMember("advertisement:create");
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      throw new AppError("Paste the recruitment requirement first.", 400);
    }

    const agency = await agencyRepository.findById(user.agencyId);
    if (!agency) throw new AppError("Agency not found.", 404);

    const qrUrl = buildQrTrackingUrl({ agencyVerificationId: user.agencyId, advertisementId: `v2-${Date.now()}` });
    const qr = await generateAndVerifyQr(qrUrl);

    const agencyLogoPng = await fetchLogoBuffer(agency.logoUrl);

    const png = await generateAdvertisementV2({
      recruiterText: text,
      agencyLogoPng,
      qrPng: qr.png,
      footerText: agency.name,
    });

    return NextResponse.json({ data: { image: `data:image/png;base64,${png.toString("base64")}` } });
  } catch (error) {
    return handleApiError(error);
  }
}

async function fetchLogoBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}
