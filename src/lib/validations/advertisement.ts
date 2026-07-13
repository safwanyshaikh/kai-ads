import { z } from "zod";

/**
 * Advertisement Schema (Sprint 002 brief). Each block is validated
 * independently so "editing one block must never affect other blocks"
 * (Product Constitution, Editing) holds at the API boundary too.
 */

export const positionSchema = z.object({
  title: z.string().trim().min(1, "Position title is required").max(120),
  count: z.coerce.number().int().min(1).max(10000).optional(),
  experience: z.string().trim().max(200).optional(),
  ageRange: z.string().trim().max(50).optional(),
  language: z.string().trim().max(120).optional(),
  qualifications: z.array(z.string().trim().max(200)).max(20).optional(),
});

const benefitSchema = z.object({
  label: z.string().trim().min(1, "Benefit label is required").max(120),
  detail: z.string().trim().max(300).optional(),
});

const interviewEventSchema = z.object({
  date: z.string().trim().max(60).optional(),
  location: z.string().trim().max(200).optional(),
  mode: z.enum(["in_person", "video", "phone"]).optional(),
});

const interviewSchema = z.object({
  date: z.string().trim().max(60).optional(),
  location: z.string().trim().max(200).optional(),
  mode: z.enum(["in_person", "video", "phone"]).optional(),
  contactPerson: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  /**
   * Decision 3: multiple interview city/date pairs (e.g. "Baroda on
   * 14th & 15th July, Mumbai on 18th July"). Additive — the singular
   * date/location/mode fields above are unchanged and still populated
   * for the common single-event case; this is populated only when the
   * requirement genuinely has 2+ distinct interview events. Stored in
   * the same schemaless `interview` Json column (see
   * server/generation/interview-events.ts), so no migration is needed.
   */
  events: z.array(interviewEventSchema).max(10).optional(),
});

const contactSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional(),
});

/** Free-form, store-only per Sprint 002 ("Styles: Store only. No rendering."). */
const themeSchema = z.record(z.string(), z.unknown()).optional();

export const advertisementStyleSchema = z.enum(["VISUAL", "TYPOGRAPHY", "NEWSPAPER"]);
const advertisementStatusSchema = z.enum(["DRAFT", "REVIEW", "APPROVED", "ARCHIVED"]);

export const createAdvertisementSchema = z.object({
  header: z.string().trim().min(1, "Header is required").max(200),
  industry: z.string().trim().min(1, "Industry is required").max(120),
  country: z.string().trim().min(1, "Country is required").max(120),
  employer: z.string().trim().max(200).optional().or(z.literal("")),
  positions: z.array(positionSchema).min(1, "At least one position is required"),
  benefits: z.array(benefitSchema).default([]),
  interview: interviewSchema.default({}),
  contact: contactSchema.default({}),
  footer: z.string().trim().max(500).optional().or(z.literal("")),
  theme: themeSchema,
  style: advertisementStyleSchema.default("VISUAL"),
  sourceDraftId: z.string().min(1).optional(),
});
export type CreateAdvertisementInput = z.infer<typeof createAdvertisementSchema>;

export const updateAdvertisementSchema = createAdvertisementSchema
  .omit({ sourceDraftId: true })
  .partial()
  .extend({
    changeSummary: z.string().trim().max(300).optional(),
  });
export type UpdateAdvertisementInput = z.infer<typeof updateAdvertisementSchema>;

export const advertisementStatusTransitionSchema = z.object({
  toStatus: advertisementStatusSchema,
  reason: z.string().trim().max(500).optional(),
});

export const advertisementSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: advertisementStatusSchema.optional(),
  style: advertisementStyleSchema.optional(),
  industry: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  createdById: z.string().trim().max(120).optional(),
  includeDeleted: z.coerce.boolean().default(false),
  includeArchived: z.coerce.boolean().default(true),
});

