import { NextResponse, type NextRequest } from "next/server";
import { qrScanService } from "@/server/services/qr-scan.service";
import { enforceRateLimit } from "@/server/rate-limit";
import { RATE_LIMITS } from "@/lib/constants";
import { createLogger } from "@/lib/logger";

const log = createLogger("qr-redirect");

function detectDeviceCategory(userAgent: string | null): string | undefined {
  if (!userAgent) return undefined;
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  if (/mobile|android|iphone/i.test(userAgent)) return "mobile";
  return "desktop";
}

function detectSourcePlatform(referrer: string | null): string | undefined {
  if (!referrer) return undefined;
  const host = (() => {
    try {
      return new URL(referrer).hostname;
    } catch {
      return "";
    }
  })();
  if (host.includes("wa.me") || host.includes("whatsapp")) return "whatsapp";
  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host.includes("fb.com")) return "facebook";
  if (host.includes("linkedin")) return "linkedin";
  if (host.includes("youtube")) return "youtube";
  return host || undefined;
}

function fallbackVerificationPage(params: {
  agencyName: string | null;
  raLicenseId: string | null;
  status: string | null;
}): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Agency Verification</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 20px; color: #111;">
  <h1 style="font-size: 20px;">${params.agencyName ?? "Agency"}</h1>
  ${params.raLicenseId ? `<p>RA License ID: ${params.raLicenseId}</p>` : ""}
  <p>KAI Verification Status: ${params.status ?? "Unknown"}</p>
  <p style="color: #555;">The official verification destination is temporarily unavailable. Please try again later.</p>
</body>
</html>`;

  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * QR Redirect Flow (Sprint 004): "Scan -> KAI Tracking Endpoint -> Record
 * permitted event -> Redirect immediately... No unnecessary intermediate
 * screen." Public — a scanning phone has no session, and none is
 * required (no candidate login/registration per the brief).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agencyVerificationId: string }> },
) {
  const { agencyVerificationId } = await params;
  const advertisementTrackingId = request.nextUrl.searchParams.get("a");

  try {
    await enforceRateLimit(request, "qr:scan", RATE_LIMITS.qrScan);
  } catch {
    // Rate limit exceeded — still show the honest fallback page, never a raw 429 to a scanning phone.
    return fallbackVerificationPage({ agencyName: null, raLicenseId: null, status: null });
  }

  if (!advertisementTrackingId) {
    return NextResponse.json({ error: { code: "MISSING_TRACKING_ID", message: "Missing advertisement reference." } }, { status: 400 });
  }

  try {
    const resolution = await qrScanService.resolveAndRecordScan(agencyVerificationId, {
      advertisementTrackingId,
      sourcePlatform: detectSourcePlatform(request.headers.get("referer")),
      countryCode: request.headers.get("x-vercel-ip-country") ?? undefined,
      region: request.headers.get("x-vercel-ip-country-region") ?? undefined,
      city: request.headers.get("x-vercel-ip-city") ?? undefined,
      deviceCategory: detectDeviceCategory(request.headers.get("user-agent")),
      referrer: request.headers.get("referer") ?? undefined,
    });

    if (resolution.destinationUrl) {
      return NextResponse.redirect(resolution.destinationUrl, { status: 302 });
    }

    return fallbackVerificationPage({
      agencyName: resolution.agencyName,
      raLicenseId: resolution.raLicenseId,
      status: resolution.verificationStatus,
    });
  } catch (error) {
    log.error({ err: error, agencyVerificationId }, "QR redirect failed");
    return fallbackVerificationPage({ agencyName: null, raLicenseId: null, status: null });
  }
}
