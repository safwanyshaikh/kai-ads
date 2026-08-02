import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { runKaiIntelligenceEngine } from "@/server/ai/kai-intelligence-engine";
import type { AiExtractionToolkit } from "@/server/ai";
import {
  readRequirementSources,
  type ReadRequirementSource,
  type RequirementSourceInput,
  type UnreadableRequirementSource,
} from "@/server/ai/requirement-source.service";
import {
  absentFact,
  buildFact,
  deterministicFact,
  reconcileFact,
  type RequirementFact,
  type RequirementSourceKind,
} from "@/server/ai/requirement-provenance";
import {
  normalizeDestinationCountry,
  normalizeEmail,
  normalizeExperienceText,
  normalizeHeadcount,
  normalizeInterviewDate,
  normalizePhone,
  normalizeSalaryText,
  normalizeTradeTitle,
} from "@/server/ai/requirement-normalization";
import type { ExtractionResult } from "@/server/ai/extraction-result.schema";
import { jobOrderService } from "@/server/services/job-order.service";
import { createAdvertisementSchema } from "@/lib/validations/advertisement";
import { auditLogService } from "@/server/services/audit-log.service";

const log = createLogger("requirement-intelligence");

/**
 * REQUIREMENT INTELLIGENCE ENGINE (Task 002)
 *
 *   ANY REQUIREMENT -> **Requirement Intelligence** -> JobOrder -> ...
 *
 * The single path from any inbound requirement — WhatsApp, PDF, image,
 * voice note, email, Word, Excel, Google Sheet, website — to exactly ONE
 * canonical JobOrder.
 *
 * This stage produces NO advertisement, NO layout, NO rendering and NO
 * distribution. It stops the moment the requirement is a durable,
 * explained business record.
 *
 * It creates no second extraction engine either: reading the channels is
 * delegated to requirement-source.service.ts, understanding the words to
 * the existing runKaiIntelligenceEngine, and persisting the requirement
 * to Task 001's jobOrderService. What this module adds is the part that
 * did not exist — canonicalization under deterministic rules, and a
 * Source/Confidence/Reason record for every single field.
 */

export type RequirementIngestStatus =
  /** A canonical JobOrder was produced. */
  | "CREATED"
  /** Nothing readable arrived — no source could be read at all. */
  | "NO_READABLE_SOURCE"
  /** Sources were read, but no position could be established, so there is no requirement to record. */
  | "INSUFFICIENT_REQUIREMENT"
  /** Extraction itself failed (provider unconfigured or errored). */
  | "EXTRACTION_FAILED";

export interface RequirementIngestResult {
  status: RequirementIngestStatus;
  jobOrderId: string | null;
  /** Every field, explained. Present even when no JobOrder was created. */
  facts: RequirementFact[];
  /** Sources that could not be read, named with the reason. */
  unreadable: UnreadableRequirementSource[];
  /** Non-fatal notes from reading the sources and from extraction. */
  warnings: string[];
}

export interface RequirementIngestParams {
  agencyId: string;
  actorId: string;
  sources: RequirementSourceInput[];
  /** Test seam — same shape as runKaiIntelligenceEngine's. */
  toolkit?: AiExtractionToolkit;
}

/**
 * Chooses which source a fact is attributed to.
 *
 * With one source this is trivial. With several, the fact is attributed
 * to the most trustworthy channel present, because that is the one the
 * extractor most likely read the value from and it is the honest ceiling
 * for the confidence score. Attribution is never invented: it always
 * names a source that was genuinely part of this requirement.
 */
const CHANNEL_RANK: Record<RequirementSourceKind, number> = {
  EXCEL: 10, GOOGLE_SHEET: 10, WORD: 9, PLAIN_TEXT: 9, EMAIL: 9,
  PDF: 8, WHATSAPP_TEXT: 7, WEBSITE: 5, IMAGE: 3, WHATSAPP_SCREENSHOT: 3, VOICE_NOTE: 2,
};

function primarySource(sources: ReadRequirementSource[]): ReadRequirementSource | null {
  if (sources.length === 0) return null;
  return [...sources].sort((a, b) => CHANNEL_RANK[b.kind] - CHANNEL_RANK[a.kind])[0];
}

interface FactContext {
  kind: RequirementSourceKind;
  sourceId: string | null;
  label: string;
}

/**
 * Builds the complete, explained fact set for one extraction result.
 *
 * Pure and exported so the explainability rules are directly testable:
 * given an extraction and a channel, exactly these facts with exactly
 * these reasons must come out, every time.
 */
export function buildRequirementFacts(
  extraction: ExtractionResult,
  context: FactContext,
): RequirementFact[] {
  const facts: RequirementFact[] = [];
  const { kind, sourceId } = context;

  const countryNorm = normalizeDestinationCountry(extraction.country.value);
  facts.push(
    buildFact({
      field: "country",
      value: countryNorm.value,
      rawValue: countryNorm.raw,
      sourceKind: kind,
      sourceId,
      band: extraction.country.confidence,
      normalization: { changed: countryNorm.changed, reason: countryNorm.reason },
    }),
  );

  const canonicalCountry = countryNorm.value;

  for (const [field, extracted] of [
    ["industry", extraction.industry],
    ["projectType", extraction.projectType],
    ["employer", extraction.employer],
  ] as const) {
    facts.push(
      buildFact({
        field,
        value: extracted.value,
        rawValue: extracted.value,
        sourceKind: kind,
        sourceId,
        band: extracted.confidence,
      }),
    );
  }

  // --- Interview -----------------------------------------------------
  const dateNorm = normalizeInterviewDate(extraction.interviewDate.value);
  facts.push(
    buildFact({
      field: "interview.date",
      value: dateNorm.value,
      rawValue: dateNorm.raw,
      sourceKind: kind,
      sourceId,
      band: extraction.interviewDate.confidence,
      normalization: { changed: dateNorm.changed, reason: dateNorm.reason },
    }),
  );
  facts.push(
    buildFact({
      field: "interview.venue",
      value: extraction.interviewVenue.value,
      rawValue: extraction.interviewVenue.value,
      sourceKind: kind,
      sourceId,
      band: extraction.interviewVenue.confidence,
    }),
  );

  // --- Contact -------------------------------------------------------
  const contact = extraction.contact.value;
  const phoneNorm = normalizePhone(contact?.phone ?? null);
  facts.push(
    buildFact({
      field: "contact.phone",
      value: phoneNorm.value,
      rawValue: phoneNorm.raw,
      sourceKind: kind,
      sourceId,
      band: extraction.contact.confidence,
      normalization: { changed: phoneNorm.changed, reason: phoneNorm.reason },
    }),
  );
  const emailNorm = normalizeEmail(contact?.email ?? null);
  facts.push(
    buildFact({
      field: "contact.email",
      value: emailNorm.value,
      rawValue: emailNorm.raw,
      sourceKind: kind,
      sourceId,
      band: extraction.contact.confidence,
      normalization: { changed: emailNorm.changed, reason: emailNorm.reason },
    }),
  );

  // --- Positions -----------------------------------------------------
  if (extraction.positions.length === 0) {
    facts.push(
      absentFact({
        field: "positions",
        sourceKind: kind,
        sourceId,
        note: "No position could be identified in any source. A requirement with no vacancy is not a requirement — nothing was invented to fill the gap.",
      }),
    );
  }

  extraction.positions.forEach((position, index) => {
    const titleNorm = normalizeTradeTitle(position.title);
    facts.push(
      buildFact({
        field: `positions.${index}.title`,
        value: titleNorm.value,
        rawValue: titleNorm.raw,
        sourceKind: kind,
        sourceId,
        // A position the extractor returned at all is a position it read;
        // the title is the one field it cannot have inferred.
        band: "HIGH",
        normalization: { changed: titleNorm.changed, reason: titleNorm.reason },
      }),
    );

    const countNorm = normalizeHeadcount(position.quantity.value);
    facts.push(
      buildFact({
        field: `positions.${index}.count`,
        value: countNorm.value === null ? null : String(countNorm.value),
        rawValue: countNorm.raw,
        sourceKind: kind,
        sourceId,
        band: position.quantity.confidence,
        normalization: { changed: countNorm.changed, reason: countNorm.reason },
      }),
    );

    const salaryRaw = buildSalaryText(position);
    const salaryNorm = normalizeSalaryText(salaryRaw, canonicalCountry);
    facts.push(
      buildFact({
        field: `positions.${index}.salary`,
        value: salaryNorm.value,
        rawValue: salaryNorm.raw,
        sourceKind: kind,
        sourceId,
        band: position.salaryAmount.confidence,
        normalization: { changed: salaryNorm.changed, reason: salaryNorm.reason },
      }),
    );

    const expNorm = normalizeExperienceText(position.experience.value);
    facts.push(
      buildFact({
        field: `positions.${index}.experience`,
        value: expNorm.value,
        rawValue: expNorm.raw,
        sourceKind: kind,
        sourceId,
        band: position.experience.confidence,
        normalization: { changed: expNorm.changed, reason: expNorm.reason },
      }),
    );

    facts.push(
      buildFact({
        field: `positions.${index}.qualification`,
        value: position.qualification.value,
        rawValue: position.qualification.value,
        sourceKind: kind,
        sourceId,
        band: position.qualification.confidence,
      }),
    );

    if (position.possibleDuplicateOfIndex !== null) {
      facts.push(
        deterministicFact({
          field: `positions.${index}.possibleDuplicateOf`,
          value: String(position.possibleDuplicateOfIndex),
          rawValue: null,
          sourceKind: kind,
          sourceId,
          reason: `Flagged as a possible duplicate of position ${position.possibleDuplicateOfIndex}. Flagged only — nothing was merged or removed, because two similar lines are routinely two genuinely different vacancies.`,
        }),
      );
    }
  });

  return facts;
}

/**
 * Renders a position's salary as source-verbatim text.
 *
 * A tiered pay scale is preserved as a scale, never flattened to its top
 * or bottom figure: "SAR 10,000 for 8-9 years, SAR 11,000 for 9-10 years"
 * is what the employer offered, and a single number would be a different
 * — and false — promise.
 */
function buildSalaryText(position: ExtractionResult["positions"][number]): string | null {
  if (position.salaryTiers.length > 0) {
    return position.salaryTiers.map((tier) => `${tier.salary} for ${tier.experience}`).join("; ");
  }
  const amount = position.salaryAmount.value;
  if (amount === null) return null;
  const currency = position.salaryCurrency.value;
  return currency ? `${currency} ${amount}` : String(amount);
}

/** Merges fact sets from several sources, resolving disagreements visibly. */
export function reconcileFactSets(factSets: RequirementFact[][]): RequirementFact[] {
  const merged = new Map<string, RequirementFact>();
  for (const set of factSets) {
    for (const fact of set) {
      const incumbent = merged.get(fact.field);
      merged.set(fact.field, incumbent ? reconcileFact(incumbent, fact) : fact);
    }
  }
  return [...merged.values()];
}

/** Reads a fact's value back out of the explained set. */
function valueOf(facts: RequirementFact[], field: string): string | null {
  return facts.find((fact) => fact.field === field)?.value ?? null;
}

/**
 * Assembles the canonical requirement content from the explained facts.
 *
 * Every value here came from a fact, and every fact carries its source,
 * confidence and reason — so nothing can reach the JobOrder without being
 * explainable. Fields the sources never stated are simply absent.
 */
export function toCanonicalRequirement(facts: RequirementFact[]) {
  const positionIndexes = [
    ...new Set(
      facts
        .map((fact) => fact.field.match(/^positions\.(\d+)\./)?.[1])
        .filter((index): index is string => index !== undefined),
    ),
  ].map(Number).sort((a, b) => a - b);

  const positions = positionIndexes
    .map((index) => {
      const title = valueOf(facts, `positions.${index}.title`);
      if (!title) return null;
      const count = valueOf(facts, `positions.${index}.count`);
      const qualification = valueOf(facts, `positions.${index}.qualification`);
      return {
        title,
        ...(count ? { count: Number(count) } : {}),
        ...(valueOf(facts, `positions.${index}.experience`)
          ? { experience: valueOf(facts, `positions.${index}.experience`) as string }
          : {}),
        ...(valueOf(facts, `positions.${index}.salary`)
          ? { salary: valueOf(facts, `positions.${index}.salary`) as string }
          : {}),
        ...(qualification ? { qualifications: [qualification] } : {}),
      };
    })
    .filter((position): position is NonNullable<typeof position> => position !== null);

  const country = valueOf(facts, "country");
  const industry = valueOf(facts, "industry");
  const employer = valueOf(facts, "employer");

  return {
    country,
    industry,
    employer,
    positions,
    interview: {
      ...(valueOf(facts, "interview.date") ? { date: valueOf(facts, "interview.date") as string } : {}),
      ...(valueOf(facts, "interview.venue") ? { location: valueOf(facts, "interview.venue") as string } : {}),
    },
    contact: {
      ...(valueOf(facts, "contact.phone") ? { phone: valueOf(facts, "contact.phone") as string } : {}),
      ...(valueOf(facts, "contact.email") ? { email: valueOf(facts, "contact.email") as string } : {}),
    },
  };
}

export const requirementIntelligenceService = {
  /**
   * Any requirement in, exactly one canonical JobOrder out.
   *
   * Everything is written in one transaction: the sources, the JobOrder
   * (with its Employer and Positions, via Task 001's service), and every
   * explained fact. A requirement that half-committed would be a
   * requirement nobody could trust.
   */
  async ingest(params: RequirementIngestParams): Promise<RequirementIngestResult> {
    const { sources, unreadable } = await readRequirementSources(params.sources);
    const warnings: string[] = [
      ...sources.flatMap((source) => source.notes),
      ...unreadable.map((source) => `${source.label}: ${source.error}`),
    ];

    if (sources.length === 0) {
      return { status: "NO_READABLE_SOURCE", jobOrderId: null, facts: [], unreadable, warnings };
    }

    const primary = primarySource(sources);
    if (!primary) {
      return { status: "NO_READABLE_SOURCE", jobOrderId: null, facts: [], unreadable, warnings };
    }

    // One extraction over the merged sources — the existing engine, not a
    // second one. Text sources are merged by that engine; an image-only
    // requirement goes down its existing vision path.
    let extraction: ExtractionResult;
    try {
      const textSources = sources.filter((source) => source.content.type === "text");
      const imageSource = sources.find((source) => source.content.type === "image");

      // Each source is labelled in the merged text so the extractor —
      // and anyone later reading the stored source — can see which
      // channel a line came from.
      const mergedText =
        textSources.length > 0
          ? textSources
              .map((source) =>
                source.content.type === "text"
                  ? `--- ${source.label} (${source.kind}) ---\n${source.content.text}`
                  : "",
              )
              .join("\n\n")
          : null;

      const outcome = await runKaiIntelligenceEngine({
        sourceType: toEngineSourceType(primary.kind),
        toolkit: params.toolkit,
        // Text wins when present; an image-only requirement goes down
        // the existing vision path with its bytes already read.
        preRead: mergedText
          ? { text: mergedText }
          : imageSource && imageSource.content.type === "image"
            ? { imageBase64: imageSource.content.base64, imageMimeType: imageSource.content.mimeType }
            : null,
      });
      extraction = outcome.result;
      warnings.push(...extraction.warnings);
    } catch (error) {
      log.warn({ err: error }, "Requirement extraction failed");
      return { status: "EXTRACTION_FAILED", jobOrderId: null, facts: [], unreadable, warnings };
    }

    // Facts are attributed to the highest-trust channel present, and its
    // ceiling caps every confidence score.
    const facts = buildRequirementFacts(extraction, {
      kind: primary.kind,
      sourceId: null,
      label: primary.label,
    });

    const canonical = toCanonicalRequirement(facts);

    if (canonical.positions.length === 0) {
      return { status: "INSUFFICIENT_REQUIREMENT", jobOrderId: null, facts, unreadable, warnings };
    }

    const content = createAdvertisementSchema.parse({
      // The JobOrder's own title. Not advertisement copy — no headline is
      // written here, and nothing about this reaches a renderer.
      header: buildRequirementTitle(canonical),
      industry: canonical.industry ?? "Not stated",
      country: canonical.country ?? "Not stated",
      ...(canonical.employer ? { employer: canonical.employer } : {}),
      positions: canonical.positions,
      benefits: (extraction.benefits.value ?? []).map((label) => ({ label })),
      interview: canonical.interview,
      contact: canonical.contact,
    });

    const jobOrderId = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Task 001's service, unchanged and uncopied. Its parameter is
      // validated requirement content; it creates the JobOrder, resolves
      // the Employer and writes the Positions. No advertisement is
      // created here — this stage produces none.
      const createdJobOrderId = await jobOrderService.provisionForAdvertisement(tx, {
        agencyId: params.agencyId,
        actorId: params.actorId,
        input: content,
      });

      const sourceIdByHash = new Map<string, string>();
      for (const source of sources) {
        const created = await tx.requirementSource.create({
          data: {
            agencyId: params.agencyId,
            jobOrderId: createdJobOrderId,
            kind: source.kind,
            label: source.label,
            contentHash: source.contentHash,
            extractedText: source.content.type === "text" ? source.content.text : null,
            mimeType: source.content.type === "image" ? source.content.mimeType : null,
            notes: source.notes as Prisma.InputJsonValue,
          },
        });
        sourceIdByHash.set(source.contentHash, created.id);
      }

      const primarySourceId = sourceIdByHash.get(primary.contentHash) ?? null;

      await tx.requirementFact.createMany({
        data: facts.map((fact) => ({
          jobOrderId: createdJobOrderId,
          sourceId: primarySourceId,
          field: fact.field,
          value: fact.value,
          rawValue: fact.rawValue,
          sourceKind: fact.sourceKind,
          sourceRef: fact.sourceRef,
          confidence: fact.confidence,
          confidenceBand: fact.confidenceBand,
          method: fact.method,
          reason: fact.reason,
        })),
      });

      return createdJobOrderId;
    });

    await auditLogService.record({
      action: "requirement.ingested",
      entity: "JobOrder",
      entityId: jobOrderId,
      agencyId: params.agencyId,
      actorId: params.actorId,
      metadata: {
        sourceKinds: sources.map((source) => source.kind),
        unreadableCount: unreadable.length,
        factCount: facts.length,
      },
    });

    log.info({ jobOrderId, sources: sources.length }, "Requirement ingested into canonical JobOrder");
    return { status: "CREATED", jobOrderId, facts, unreadable, warnings };
  },

  /** Every fact behind a requirement, for explaining it back to a recruiter. */
  async explain(jobOrderId: string, agencyId: string) {
    return db.requirementFact.findMany({
      where: { jobOrder: { id: jobOrderId, agencyId } },
      orderBy: [{ field: "asc" }],
      include: { source: true },
    });
  },
};

/**
 * A plain description of the requirement, used as the JobOrder's title.
 *
 * Deliberately mechanical — trade, headcount, destination. This is a
 * record label, NOT advertisement copy: no persuasion, no urgency, no
 * adjectives. Campaign Intelligence writes headlines, and it runs later.
 */
function buildRequirementTitle(canonical: ReturnType<typeof toCanonicalRequirement>): string {
  const totalRoles = canonical.positions.length;
  const lead = canonical.positions[0]?.title ?? "Requirement";
  const destination = canonical.country ?? "Not stated";
  const suffix = totalRoles > 1 ? ` and ${totalRoles - 1} other role${totalRoles > 2 ? "s" : ""}` : "";
  return `${lead}${suffix} — ${destination}`.slice(0, 200);
}

function toEngineSourceType(
  kind: RequirementSourceKind,
): "PASTE_TEXT" | "PDF" | "DOCX" | "IMAGE" | "WHATSAPP_SCREENSHOT" {
  switch (kind) {
    case "PDF": return "PDF";
    case "WORD": return "DOCX";
    case "IMAGE": return "IMAGE";
    case "WHATSAPP_SCREENSHOT": return "WHATSAPP_SCREENSHOT";
    default: return "PASTE_TEXT";
  }
}
