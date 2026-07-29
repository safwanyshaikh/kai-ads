import type { Metadata } from "next";
import { headers } from "next/headers";
import { qrScanService } from "@/server/services/qr-scan.service";
import { createLogger } from "@/lib/logger";

const log = createLogger("qr-verification-page");

export const metadata: Metadata = { title: "Agency Verification — KAI" };
export const dynamic = "force-dynamic";

const NAVY = "#0B1F33";
const CREAM = "#F3EEE3";
const GOLD = "#F3D98B";
const SLATE = "#4A5A6C";

function detectDeviceCategory(userAgent: string | null): string | undefined {
  if (!userAgent) return undefined;
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  if (/mobile|android|iphone/i.test(userAgent)) return "mobile";
  return "desktop";
}

function detectSourcePlatform(referrer: string | null): string | undefined {
  if (!referrer) return undefined;
  let host = "";
  try {
    host = new URL(referrer).hostname;
  } catch {
    return undefined;
  }
  if (host.includes("wa.me") || host.includes("whatsapp")) return "whatsapp";
  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host.includes("fb.com")) return "facebook";
  if (host.includes("linkedin")) return "linkedin";
  return host || undefined;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: `1px solid ${GOLD}33` }}>
      <span style={{ color: SLATE, fontSize: 13 }}>{label}</span>
      <span style={{ color: NAVY, fontSize: 13, fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

/**
 * The KAI Agency Verification page — what a candidate sees after scanning
 * the QR on a published advertisement.
 *
 * This route previously redirected straight to the government site, which
 * meant KAI was invisible in its own trust chain: a candidate had no way
 * to see who published the advertisement, under which licence, or how to
 * contact them. The candidate now lands on KAI first and continues to the
 * official government source from here — KAI vouches, the government
 * remains the final authority.
 *
 * Public and session-free by design: a scanning phone has no account, and
 * no candidate identity is ever collected.
 */
export default async function AgencyVerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencyVerificationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { agencyVerificationId } = await params;
  const { a: advertisementTrackingId } = await searchParams;
  const h = await headers();

  let resolution: Awaited<ReturnType<typeof qrScanService.resolveAndRecordScan>> | null = null;
  try {
    resolution = await qrScanService.resolveAndRecordScan(agencyVerificationId, {
      advertisementTrackingId: advertisementTrackingId ?? "",
      sourcePlatform: detectSourcePlatform(h.get("referer")),
      countryCode: h.get("x-vercel-ip-country") ?? undefined,
      region: h.get("x-vercel-ip-country-region") ?? undefined,
      city: h.get("x-vercel-ip-city") ?? undefined,
      deviceCategory: detectDeviceCategory(h.get("user-agent")),
      referrer: h.get("referer") ?? undefined,
    });
  } catch (error) {
    // A scanning candidate must never see an error page; recording the
    // scan is our telemetry concern, not theirs.
    log.error({ err: error, agencyVerificationId }, "QR verification page failed to resolve");
  }

  const verified = resolution?.verificationStatus === "VERIFIED";
  const agencyName = resolution?.agencyName ?? "Agency";

  return (
    <main style={{ background: CREAM, minHeight: "100vh", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ background: NAVY, borderRadius: "12px 12px 0 0", padding: 24, textAlign: "center" }}>
          {resolution?.agencyLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolution.agencyLogoUrl}
              alt=""
              style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 12, background: "#fff", padding: 6, marginBottom: 12 }}
            />
          )}
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>{agencyName}</h1>

          {verified ? (
            <p style={{ display: "inline-block", marginTop: 12, background: GOLD, color: NAVY, fontSize: 12, fontWeight: 700, letterSpacing: 1, padding: "6px 14px", borderRadius: 999 }}>
              ✓ VERIFIED BY KAI
            </p>
          ) : (
            <p style={{ display: "inline-block", marginTop: 12, background: "#fff", color: NAVY, fontSize: 12, fontWeight: 700, letterSpacing: 1, padding: "6px 14px", borderRadius: 999 }}>
              VERIFICATION PENDING
            </p>
          )}
        </div>

        <div style={{ background: "#fff", padding: 24, borderRadius: "0 0 12px 12px" }}>
          {resolution?.raLicenseId && <Row label="MEA licence number" value={resolution.raLicenseId} />}
          {resolution?.agencyPhone && <Row label="Phone" value={resolution.agencyPhone} />}
          {resolution?.agencyWhatsapp && <Row label="WhatsApp" value={resolution.agencyWhatsapp} />}
          {resolution?.agencyEmail && <Row label="Email" value={resolution.agencyEmail} />}
          {resolution?.agencyWebsite && <Row label="Website" value={resolution.agencyWebsite} />}
          {resolution?.agencyOfficeAddress && <Row label="Office" value={resolution.agencyOfficeAddress} />}
          {resolution?.advertisementHeader && <Row label="Advertisement" value={resolution.advertisementHeader} />}
          {resolution?.advertisementId && <Row label="Advertisement ID" value={resolution.advertisementId} />}
          {resolution?.advertisementPublishedAt && (
            <Row
              label="Published"
              value={new Date(resolution.advertisementPublishedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
          )}

          {resolution?.destinationUrl ? (
            <>
              <a
                href={resolution.destinationUrl}
                rel="noopener noreferrer"
                style={{ display: "block", marginTop: 24, background: NAVY, color: GOLD, textAlign: "center", padding: "14px 16px", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}
              >
                Verify on the official government website
              </a>
              <p style={{ color: SLATE, fontSize: 12, marginTop: 12, textAlign: "center" }}>
                KAI confirms this agency&apos;s identity. The Government of India remains the final
                authority on its licence.
              </p>
            </>
          ) : (
            <p style={{ color: SLATE, fontSize: 13, marginTop: 24, textAlign: "center" }}>
              This agency&apos;s official verification link is not available yet. Contact the agency
              directly using the details above.
            </p>
          )}
        </div>

        <p style={{ color: SLATE, fontSize: 11, textAlign: "center", marginTop: 20 }}>
          Verified and published through KAI Ads
        </p>
      </div>
    </main>
  );
}
