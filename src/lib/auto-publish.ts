import { z } from "zod";
import type { ExtractionResult } from "@/server/ai/extraction-result.schema";
import {
  createAdvertisementSchema,
  positionSchema,
  type CreateAdvertisementInput,
} from "@/lib/validations/advertisement";
import { extractionResultToFormValues } from "@/lib/extraction-to-form";

/**
 * KAI AUTO-PUBLISH
 *
 * Core recruitment facts are the publication gate.
 *
 * REQUIRED TO GENERATE:
 * - header
 * - industry
 * - country
 * - at least one position
 *
 * OPTIONAL SOURCE DATA:
 * - employer
 * - salary
 * - benefits
 * - interview
 * - contact
 * - footer
 * - experience
 * - qualifications
 *
 * Optional malformed data must NEVER force the recruiter into a
 * data-entry form when the core recruitment opportunity is already
 * grounded and usable.
 *
 * KAI does not invent missing facts.
 * It simply drops malformed optional fields and continues with
 * the verified facts that actually exist.
 */
export type AutoPublishPlan =
  | {
      mode: "auto";
      input: CreateAdvertisementInput;
    }
  | {
      mode: "manual";
      reason: string;
      partial: Partial<CreateAdvertisementInput>;
    };

export function planAutoPublish(
  extracted: ExtractionResult,
): AutoPublishPlan {
  /**
   * First transform the complete extraction result into the
   * advertisement domain shape.
   */
  const mapped =
    extractionResultToFormValues(
      extracted,
    );

  /**
   * Clean every position independently.
   *
   * A bad optional field on one position must not destroy the
   * complete recruitment requirement.
   */
  const positions =
    Array.isArray(
      mapped.positions,
    )
      ? mapped.positions
          .map(cleanPosition)
          .filter(
            (
              position,
            ): position is NonNullable<
              ReturnType<typeof cleanPosition>
            > =>
              Boolean(position),
          )
      : [];

  /**
   * These are the ONLY hard requirements for automatic
   * advertisement creation.
   */
  const core = {
    style: "VISUAL" as const,

    header:
      typeof mapped.header ===
      "string"
        ? mapped.header.trim()
        : "",

    industry:
      typeof mapped.industry ===
      "string"
        ? mapped.industry.trim()
        : "",

    country:
      typeof mapped.country ===
      "string"
        ? mapped.country.trim()
        : "",

    positions,
  };

  const coreResult =
    createAdvertisementSchema.safeParse(
      core,
    );

  /**
   * If the actual recruitment core is missing, THEN we ask
   * the recruiter.
   *
   * This is a genuine missing-source-data condition.
   */
  if (!coreResult.success) {
    const missing =
      [
        ...new Set(
          coreResult.error.issues.map(
            (issue) =>
              String(
                issue.path[0],
              ),
          ),
        ),
      ];

    return {
      mode: "manual",

      reason:
        `KAI could not confirm the minimum facts required to advertise this requirement: ${missing.join(
          ", ",
        )}.`,

      partial:
        mapped,
    };
  }

  /**
   * Start from the validated core.
   *
   * The schema automatically provides:
   * - benefits: []
   * - interview: {}
   * - style: VISUAL
   */
  const candidate: Record<
    string,
    unknown
  > = {
    ...coreResult.data,
  };

  /**
   * Optional employer.
   */
  if (
    typeof mapped.employer ===
      "string" &&
    mapped.employer.trim()
  ) {
    candidate.employer =
      mapped.employer.trim();
  } else {
    candidate.employer = "";
  }

  /**
   * Optional benefits.
   *
   * Invalid individual benefit entries are discarded.
   * Valid benefits survive.
   */
  candidate.benefits =
    cleanBenefits(
      mapped.benefits,
    );

  /**
   * Optional interview information.
   *
   * Invalid modes/events are removed rather than blocking
   * the whole requirement.
   */
  candidate.interview =
    cleanInterview(
      mapped.interview,
    );

  /**
   * Optional contact information.
   *
   * Invalid email addresses do not block generation.
   */
  candidate.contact =
    cleanContact(
      mapped.contact,
    );

  /**
   * Footer and theme are optional and are not part of the
   * extraction-created publication decision.
   */
  if (
    typeof mapped.footer ===
      "string" &&
    mapped.footer.trim()
  ) {
    candidate.footer =
      mapped.footer.trim();
  }

  if (
    mapped.theme !==
    undefined
  ) {
    candidate.theme =
      mapped.theme;
  }

  /**
   * Final validation.
   *
   * Because all optional structures were cleaned individually,
   * this should succeed whenever the core requirement is valid.
   */
  const finalResult =
    createAdvertisementSchema.safeParse(
      candidate,
    );

  if (
    finalResult.success
  ) {
    return {
      mode: "auto",
      input:
        finalResult.data,
    };
  }

  /**
   * Last-resort recovery:
   *
   * The core recruitment facts are valid, but some optional
   * structured data is still incompatible with the storage schema.
   *
   * Strip optional fields and publish the verified core rather
   * than dumping the recruiter into a data-entry form.
   */
  const coreOnly =
    createAdvertisementSchema.safeParse(
      core,
    );

  if (
    coreOnly.success
  ) {
    return {
      mode: "auto",
      input:
        coreOnly.data,
    };
  }

  /**
   * Only here do we fall back to manual entry.
   */
  return {
    mode: "manual",

    reason:
      "The source did not contain enough grounded recruitment information to create a valid advertisement.",

    partial:
      mapped,
  };
}

/**
 * Clean one extracted position without inventing anything.
 */
function cleanPosition(
  raw: unknown,
) {
  if (
    !raw ||
    typeof raw !==
      "object"
  ) {
    return null;
  }

  const value =
    raw as Record<
      string,
      unknown
    >;

  const title =
    typeof value.title ===
    "string"
      ? value.title.trim()
      : "";

  if (!title) {
    return null;
  }

  const position: Record<
    string,
    unknown
  > = {
    title:
      title.slice(
        0,
        120,
      ),
  };

  /**
   * Optional count.
   */
  if (
    typeof value.count ===
      "number" &&
    Number.isInteger(
      value.count,
    ) &&
    value.count >= 1 &&
    value.count <=
      10000
  ) {
    position.count =
      value.count;
  }

  /**
   * Optional experience.
   */
  if (
    typeof value.experience ===
      "string" &&
    value.experience.trim()
      .length <= 200
  ) {
    position.experience =
      value.experience.trim();
  }

  /**
   * Optional salary.
   */
  if (
    typeof value.salary ===
      "string" &&
    value.salary.trim()
      .length <= 300
  ) {
    position.salary =
      value.salary.trim();
  }

  /**
   * Optional age range.
   */
  if (
    typeof value.ageRange ===
      "string" &&
    value.ageRange.trim()
      .length <= 50
  ) {
    position.ageRange =
      value.ageRange.trim();
  }

  /**
   * Optional language.
   */
  if (
    typeof value.language ===
      "string" &&
    value.language.trim()
      .length <= 120
  ) {
    position.language =
      value.language.trim();
  }

  /**
   * Optional qualifications.
   */
  if (
    Array.isArray(
      value.qualifications,
    )
  ) {
    const qualifications =
      value.qualifications
        .filter(
          (
            item,
          ): item is string =>
            typeof item ===
            "string",
        )
        .map(
          (item) =>
            item.trim(),
        )
        .filter(
          (item) =>
            item.length > 0 &&
            item.length <= 200,
        )
        .slice(0, 20);

    if (
      qualifications.length
    ) {
      position.qualifications =
        qualifications;
    }
  }

  /**
   * Final individual position validation.
   *
   * If an optional field remains problematic, fall back to
   * the title-only version rather than deleting the position.
   */
  const parsed =
    positionSchema.safeParse(
      position,
    );

  if (
    parsed.success
  ) {
    return parsed.data;
  }

  return {
    title:
      position.title as string,
  };
}

/**
 * Benefits are optional.
 */
function cleanBenefits(
  value: unknown,
) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is {
        label: string;
        detail?: string;
      } =>
        Boolean(item) &&
        typeof item ===
          "object" &&
        typeof (
          item as Record<
            string,
            unknown
          >
        ).label === "string",
    )
    .map(
      (item) => {
        const value =
          item as {
            label: string;
            detail?: string;
          };

        const label =
          value.label
            .trim()
            .slice(0, 120);

        if (!label) {
          return null;
        }

        const detail =
          typeof value.detail ===
            "string"
            ? value.detail
                .trim()
                .slice(
                  0,
                  300,
                )
            : undefined;

        return {
          label,
          ...(detail
            ? { detail }
            : {}),
        };
      },
    )
    .filter(
      (
        value,
      ): value is {
        label: string;
        detail?: string;
      } =>
        Boolean(value),
    );
}

/**
 * Interview data is optional.
 */
function cleanInterview(
  value: unknown,
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {};
  }

  const source =
    value as Record<
      string,
      unknown
    >;

  const result: Record<
    string,
    unknown
  > = {};

  if (
    typeof source.date ===
      "string" &&
    source.date.trim()
  ) {
    result.date =
      source.date
        .trim()
        .slice(0, 60);
  }

  if (
    typeof source.location ===
      "string" &&
    source.location.trim()
  ) {
    result.location =
      source.location
        .trim()
        .slice(0, 200);
  }

  if (
    source.mode ===
      "in_person" ||
    source.mode === "video" ||
    source.mode === "phone"
  ) {
    result.mode =
      source.mode;
  }

  if (
    typeof source.contactPerson ===
      "string" &&
    source.contactPerson.trim()
  ) {
    result.contactPerson =
      source.contactPerson
        .trim()
        .slice(0, 120);
  }

  if (
    typeof source.notes ===
      "string" &&
    source.notes.trim()
  ) {
    result.notes =
      source.notes
        .trim()
        .slice(0, 500);
  }

  if (
    Array.isArray(
      source.events,
    )
  ) {
    const events =
      source.events
        .filter(
          (
            event,
          ): event is Record<
            string,
            unknown
          > =>
            Boolean(event) &&
            typeof event ===
              "object",
        )
        .map(
          (
            event,
          ) => {
            const cleaned: Record<
              string,
              unknown
            > = {};

            if (
              typeof event.date ===
                "string" &&
              event.date.trim()
            ) {
              cleaned.date =
                event.date
                  .trim()
                  .slice(
                    0,
                    60,
                  );
            }

            if (
              typeof event.location ===
                "string" &&
              event.location.trim()
            ) {
              cleaned.location =
                event.location
                  .trim()
                  .slice(
                    0,
                    200,
                  );
            }

            if (
              event.mode ===
                "in_person" ||
              event.mode ===
                "video" ||
              event.mode ===
                "phone"
            ) {
              cleaned.mode =
                event.mode;
            }

            return cleaned;
          },
        )
        .filter(
          (event) =>
            Object.keys(
              event,
            ).length >
            0,
        )
        .slice(0, 10);

    if (events.length) {
      result.events =
        events;
    }
  }

  return result;
}

/**
 * Contact is optional.
 */
function cleanContact(
  value: unknown,
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {};
  }

  const source =
    value as Record<
      string,
      unknown
    >;

  const result: Record<
    string,
    string
  > = {};

  if (
    typeof source.name ===
      "string" &&
    source.name.trim()
  ) {
    result.name =
      source.name
        .trim()
        .slice(0, 120);
  }

  if (
    typeof source.phone ===
      "string" &&
    source.phone.trim()
  ) {
    result.phone =
      source.phone
        .trim()
        .slice(0, 40);
  }

  if (
    typeof source.whatsapp ===
      "string" &&
    source.whatsapp.trim()
  ) {
    result.whatsapp =
      source.whatsapp
        .trim()
        .slice(0, 40);
  }

  if (
    typeof source.email ===
      "string" &&
    source.email.trim()
  ) {
    const email =
      source.email.trim();

    const validEmail =
      z.string()
        .email()
        .safeParse(
          email,
        ).success;

    if (validEmail) {
      result.email =
        email;
    }
  }

  return result;
}
