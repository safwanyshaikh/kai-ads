# TASK 5 — Trust Layer Audit

**Governing law:** Supreme Constitution Principle 11 (agency verification, QR
verification, invisible metadata, generation ID, authenticity proof, subtle
agency watermark/fingerprint) and Principle 2 (KAI validates and ENRICHES —
never redraws). Evidence files: `src/server/generation/qr-renderer.ts`,
`trust-validation.service.ts`, `gpt-native/trust-layer.ts`,
`image-export.service.ts`, `src/app/v/[agencyVerificationId]/route.ts`,
`prisma/schema.prisma` (QrScanEvent, AgencyVerification, AdvertisementVersion,
AiUsageLog).

## Current state by P11 requirement

| Requirement | Status | Evidence |
|---|---|---|
| QR verification | **STRONG** | Real encode + self-decode round-trip; undecodable QR hard-BLOCKs trust status (`qr-renderer.ts:37`, `trust-validation.service.ts:36`). Always encodes the KAI-controlled `/v/` route on `KAI_PUBLIC_DOMAIN`, never MEA/eMigrate directly. Composited-QR decodability is test-proven on BOTH pipelines (`tests/qr-composition-pipeline.test.ts`, `tests/gpt-native-trust-layer.test.ts` — decodes the QR back out of the final PNG's trust zone). |
| Agency verification | **STRONG** | Full admin verification workflow + public `/v/` resolution page recording every scan (`qr-scan.service.ts`, `QrScanEvent` model with platform/geo/device fields). Unverified agencies resolve honestly to an UNVERIFIED status page — no false claims. |
| Invisible metadata | **PARTIAL** | GPT-native path: EXIF `Copyright` (agency) + `Software` (`kai-ads-gpt-native-v{n}`) via `sharp.withMetadata` (`trust-layer.ts`). Legacy path: **none** — and its export step re-encodes through sharp without `withMetadata` (`image-export.service.ts:83-87` jpeg branch), which strips metadata by sharp default. |
| Generation ID | **PARTIAL** | The advertisement ID travels in the QR URL (`?a={advertisementId}`) — pixel-borne, robust. Version rides in the EXIF Software string. But no *named, documented, human-readable* generation-ID scheme exists, and nothing prints it on the artwork. |
| Authenticity proof | **PARTIAL** | Internal provenance chain is complete (AdvertisementVersion snapshots + AiUsageLog + AuditLog). External proof rests entirely on the QR → `/v/` lookup. No cryptographic binding between a specific image file and KAI's record. |
| Agency watermark / copyright fingerprint | **ABSENT** | No visible watermark, no steganographic fingerprint, on either pipeline (grep: no watermark module exists). |
| Tamper resistance | **WEAK** | EXIF is trivially strippable/editable; no signature, no C2PA, no content hash registered. |

## Social-media survival analysis (the realistic threat model)

Recruitment ads circulate on WhatsApp/Facebook/Instagram, all of which
**re-encode images and strip metadata on upload**. Survival ranking of KAI's
current trust carriers:

1. **Survives everything:** the QR code (pixel-borne) and any visible mark —
   these are the only carriers that reach the end candidate intact.
2. **Survives file-forwarding only:** EXIF metadata (dies on platform upload).
3. **Survives nothing external:** database provenance (internal only, but
   authoritative for disputes).

Conclusion: today, ownership protection effectively equals "the QR is still on
the image." Cropping the bottom-right corner removes every external trust
signal at once — a single point of failure.

## Constitution-compliant recommendations (recommendations only)

All are Trust-Layer composites (enrichment) — none redraw GPT's artwork, so all
are P2-safe:

1. **R1 — Visible agency mark beside the QR (closes the single-point-of-failure):**
   composite the agency wordmark/logo + a micro-printed generation ID into the
   already-reserved trust zone. Survives every platform; cropping it now
   removes an OBVIOUS design element, making tampering self-evident. Satisfies
   "subtle watermark… without distracting" (the zone is already reserved and
   clean by prompt contract).
2. **R2 — Formal generation ID:** define `KAI-{advertisementId-short}-v{n}`,
   persist it, micro-print it (R1), embed it in EXIF/XMP, display it on the
   `/v/` page. Turns "authenticity proof" into a checkable claim: anyone
   holding a print can read the ID and verify at the QR destination.
3. **R3 — Metadata parity + preservation:** apply the same EXIF/XMP enrichment
   on the legacy path while it lives, and pass `withMetadata()` through the
   export re-encodes so KAI's own export step stops stripping KAI's own
   metadata.
4. **R4 — Lightweight cryptographic binding:** store a SHA-256 of the final
   PNG plus an HMAC over (generationId, agencyId, hash) server-side; show
   "image matches KAI's record" on the `/v/` page for any re-uploaded copy.
   No image change at all — pure verification backend. (Strongest
   effort-to-value ratio of all options.)
5. **R5 — C2PA content credentials (later):** the industry-standard signed
   provenance manifest; survives as sidecar/embedded claim, increasingly
   surfaced by platforms. Adopt after R1–R4; requires signing-key management.
6. **R6 — Steganographic fingerprint (last):** frequency-domain invisible
   watermark is the only invisible carrier that survives re-encoding, but is
   research-grade effort; the realistic threat model is already covered by
   R1+R2+R4.

**Priority order: R1 → R2 → R3 → R4 → R5 → R6.**
