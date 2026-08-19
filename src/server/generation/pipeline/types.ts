import type { InterviewEvent } from "../interview-events";

/**
 * ============================================================================
 * KAI ADS — GENERATION DATA CONTRACT
 * ============================================================================
 *
 * Two different domains must never be confused:
 *
 * 1. AGENCY TRUST PROFILE
 *    Persistent identity of the recruitment agency.
 *
 * 2. ADVERTISEMENT CAMPAIGN
 *    Recruitment information belonging to one specific campaign.
 *
 * Gemini decides the visual presentation.
 * KAI remains the source-of-truth for exact values.
 *
 * IMPORTANT:
 * This file keeps the existing fields temporarily for backward compatibility.
 * The new structured objects are the direction we will migrate the pipeline to.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/* AGENCY TRUST PROFILE                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Persistent agency identity.
 *
 * These values belong to the Agency profile, not to an individual vacancy.
 *
 * Agency users may submit/update them.
 * Super Admin verification determines whether they are trusted for output.
 */
export interface VerifiedAgencyProfile {
  /**
   * Registered agency name.
   */
  agencyName: string;

  /**
   * Approved agency logo asset.
   */
  logoUrl?: string | null;

  /**
   * Core RC number used in compact visual areas.
   */
  rcNumber?: string | null;

  /**
   * Full official registration string.
   */
  fullRegistrationNumber?: string | null;

  /**
   * Explicit Ministry of External Affairs / Government of India
   * registration state.
   *
   * Example:
   * "MEA Registered"
   */
  meaRegistrationText?: string | null;

  /**
   * Optional ISO certification identity.
   */
  isoCertification?: string | null;

  /**
   * Optional approved ISO logo asset.
   */
  isoLogoUrl?: string | null;

  /**
   * Official registered office address.
   *
   * This is NOT an interview venue.
   */
  registeredAddress?: string | null;

  /**
   * Official agency phone.
   */
  officialPhone?: string | null;

  /**
   * Official agency email.
   */
  officialEmail?: string | null;

  /**
   * Official agency website.
   */
  website?: string | null;

  /**
   * Whether the agency profile has passed KAI/Super Admin verification.
   */
  verificationStatus?:
    | "UNVERIFIED"
    | "VERIFIED"
    | "SUSPENDED"
    | "REVERIFICATION_REQUIRED";

  /**
   * Optional verification reference.
   */
  verificationId?: string | null;

  /**
   * Optional verification URL / official destination used by QR.
   */
  verificationUrl?: string | null;

  /**
   * Optional permanent agency claims that have been approved.
   *
   * Examples:
   * - "Since 1984"
   * - "MEA Registered"
   * - "ISO 9001:2015"
   */
  approvedBadges?: string[];
}

/* -------------------------------------------------------------------------- */
/* ADVERTISEMENT CAMPAIGN CONTACT                                             */
/* -------------------------------------------------------------------------- */

/**
 * Candidate-facing contact belonging to THIS recruitment campaign.
 *
 * This is intentionally separate from the agency's official contact.
 *
 * Example:
 * Agency official email:
 *   jobs@alyousufent.com
 *
 * Campaign application email:
 *   ai@alyousufent.com
 */
export interface AdvertisementCampaignContact {
  name?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
}

/* -------------------------------------------------------------------------- */
/* ADVERTISEMENT CAMPAIGN INTERVIEW                                           */
/* -------------------------------------------------------------------------- */

/**
 * Interview information belongs to the campaign.
 *
 * It must NEVER replace the agency's registered address.
 */
export interface AdvertisementInterview {
  events: InterviewEvent[];

  /**
   * Optional explicit candidate-facing venue label.
   *
   * Example:
   * "Mumbai"
   * "Navi Mumbai"
   * "Kochi"
   */
  venue?: string | null;
}

/* -------------------------------------------------------------------------- */
/* ADVERTISEMENT FACTS                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Complete source-grounded factual payload of one advertisement.
 *
 * Every value here must trace back to the Advertisement record / source
 * extraction. No downstream stage may invent recruitment facts.
 *
 * IMPORTANT OWNERSHIP RULE:
 *
 * Campaign facts:
 *   header
 *   industry
 *   country
 *   employer
 *   projectType
 *   positions
 *   benefits
 *   interview
 *   contact
 *
 * Agency trust facts:
 *   agencyProfile
 *
 * The legacy agency fields at the bottom remain temporarily for compatibility
 * with the existing generation pipeline and will be removed only after all
 * callers have migrated.
 */
export interface AdvertisementFacts {
  /* ---------------------------------------------------------------------- */
  /* CAMPAIGN IDENTITY                                                       */
  /* ---------------------------------------------------------------------- */

  /**
   * Raw source header.
   *
   * This may be CRM-style text such as:
   * "Operation Manager + 18 more roles — Saudi Arabia"
   *
   * It is SOURCE DATA, not automatically the final creative headline.
   */
  header: string;

  industry: string;

  country: string;

  /**
   * Confirmed employer/client.
   */
  employer?: string | null;

  /**
   * Named project/site.
   *
   * Example:
   * "Major Oil & Gas Project"
   */
  projectType?: string | null;

  /**
   * Work-permit / visa category when explicitly present.
   */
  visaType?: string | null;

  /**
   * Duty-hours information when explicitly present.
   */
  dutyHours?: string | null;

  /**
   * Rotation information when explicitly present.
   */
  rotation?: string | null;

  /**
   * Verified urgency signal — true only when the source itself states
   * urgency (e.g. "We have an urgent requirement"). Never inferred by
   * a renderer from free text at draw time, and never used to invent a
   * deadline: it licenses an allowed CTA phrase ("URGENT HIRING",
   * "APPLY NOW"), nothing date-specific.
   */
  urgent?: boolean | null;

  /* ---------------------------------------------------------------------- */
  /* POSITIONS                                                               */
  /* ---------------------------------------------------------------------- */

  positions: {
    title: string;

    count?: number;

    experience?: string;

    salary?: string | null;

    /**
     * Education / qualification requirement.
     */
    qualification?: string | null;

    /**
     * Required certifications/tickets.
     */
    certifications?: string[];

    ageLimit?: string | null;

    /**
     * A verified grouping label the SOURCE document itself supplied for
     * this position (e.g. a table heading like "Manpower Requirement
     * for Waterproofing Div."). Optional — most requirements don't
     * carry one, and it is never invented when absent. Consumed by the
     * one role-family classifier (src/lib/role-families.ts) as an
     * additional signal alongside the title.
     */
    sourceDivision?: string | null;

    /**
     * Functional technical duties/skill description — what a role
     * actually does. Deliberately separate from `qualification`, which
     * is a formal credential: a trades requirement can state duties
     * with no formal qualification at all.
     */
    technicalDuties?: string | null;
  }[];

  /**
   * TRUE campaign totals, when `positions` above carries only a SELECTION
   * of the campaign (a carousel cover hook, for example) rather than the
   * whole list.
   *
   * Factual Integrity Law: a headline count is a verified fact about the
   * CAMPAIGN, not about whichever positions happen to be on this canvas.
   * A cover that shows four hook roles must still say "127 VACANCIES ·
   * 19 ROLES". When absent, the totals are the positions above — the
   * ordinary single-image case, where the two are the same thing.
   */
  campaignTotals?: {
    vacancies: number;
    roles: number;
  } | null;

  /* ---------------------------------------------------------------------- */
  /* BENEFITS                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Only source-grounded benefits.
   */
  benefits: {
    label: string;
    detail?: string;
  }[];

  /* ---------------------------------------------------------------------- */
  /* INTERVIEW                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Campaign interview information.
   *
   * Interview venue is NOT the agency registered address.
   */
  interview: InterviewEvent[];

  /**
   * Optional explicit candidate-facing venue.
   *
   * Kept separate from agencyProfile.registeredAddress.
   */
  interviewVenue?: string | null;

  /* ---------------------------------------------------------------------- */
  /* CAMPAIGN CONTACT                                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Candidate-facing contact for THIS advertisement.
   */
  contact: AdvertisementCampaignContact;

  /* ---------------------------------------------------------------------- */
  /* VERIFIED AGENCY PROFILE                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * New canonical agency identity object.
   *
   * This will become the ONLY agency source used by the final generation
   * pipeline after migration is complete.
   */
  agencyProfile?: VerifiedAgencyProfile | null;

  /* ---------------------------------------------------------------------- */
  /* SOURCE / LEGAL                                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * Agency registered address.
   *
   * LEGACY FIELD.
   *
   * New code must use:
   * agencyProfile.registeredAddress
   */
  officeAddress?: string | null;

  /**
   * Agency website.
   *
   * LEGACY FIELD.
   *
   * New code must use:
   * agencyProfile.website
   */
  website?: string | null;

  /**
   * Verbatim legal/disclaimer text.
   */
  legalDisclaimer?: string | null;

  /**
   * Legacy footer text.
   *
   * New creative architecture must NOT treat this as a fixed visual footer.
   * Gemini decides the visual footer composition.
   */
  footer?: string | null;

  /* ---------------------------------------------------------------------- */
  /* LEGACY AGENCY FIELDS                                                    */
  /* ---------------------------------------------------------------------- */

  /**
   * LEGACY — migrate to agencyProfile.agencyName.
   *
   * Optional: agencyProfile is the canonical source, and a caller that
   * supplies it must not also be required to restate the same name in a
   * legacy field that could then disagree with it.
   */
  agencyName?: string;

  /**
   * LEGACY — migrate to agencyProfile.rcNumber.
   */
  raLicenseId?: string | null;

  /**
   * LEGACY — migrate to agencyProfile.fullRegistrationNumber.
   */
  fullRegistrationNumber?: string | null;
}

/* -------------------------------------------------------------------------- */
/* CREATIVE PLANNING CONTRACT                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Candidate-facing campaign identity created by KAI from source facts.
 *
 * This is intentionally separate from the raw CRM/source header.
 */
export interface AdvertisementCampaignIdentity {
  headline: string;

  destinationIndustry: string;

  country: string;

  industry: string;

  projectType?: string | null;

  employer?: string | null;

  totalVacancies: number;

  totalDistinctRoles: number;
}

/* -------------------------------------------------------------------------- */
/* CREATIVE ARCHETYPE                                                         */
/* -------------------------------------------------------------------------- */

export type CreativeArchetype =
  | "HERO_RECRUITMENT_POSTER"
  | "HIGH_DENSITY_RECRUITMENT_POSTER"
  | "RECRUITMENT_CAROUSEL";

/* -------------------------------------------------------------------------- */
/* CONTENT DENSITY                                                            */
/* -------------------------------------------------------------------------- */

export type AdvertisementContentDensity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "EXTREME";

/**
 * KAI must decide whether all campaign information can remain readable in
 * one frame.
 *
 * Never solve density by shrinking the font indefinitely.
 */
export interface AdvertisementDensityDecision {
  density: AdvertisementContentDensity;

  minimumRoleFontPx: number;

  canFitSinglePoster: boolean;

  requiresCarousel: boolean;

  recommendedArchetype: CreativeArchetype;
}

/* -------------------------------------------------------------------------- */
/* TRUST OUTPUT CONTRACT                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Exact values KAI is allowed to protect deterministically after Gemini.
 *
 * This is NOT the advertisement body.
 */
export interface AdvertisementTrustLayer {
  agencyProfile: VerifiedAgencyProfile;

  /**
   * Candidate-facing contact can be included in Gemini's campaign design,
   * but the exact source value remains available here for validation.
   */
  campaignContact?: AdvertisementCampaignContact | null;

  /**
   * Campaign interview venue is not an agency identity field.
   */
  interviewVenue?: string | null;

  /**
   * QR verification payload.
   */
  verificationUrl?: string | null;
}
