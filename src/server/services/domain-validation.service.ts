import { domainRepository } from "@/server/repositories/domain.repository";
import { agencyRepository } from "@/server/repositories/agency.repository";
import { AppError } from "@/lib/errors";
import { extractDomain } from "./email-validation.service";

/**
 * Business Domain Validation — Sprint 001:
 * "Reject Duplicate Domain" during registration,
 * "System Detects Domain" during Employee Join Request.
 *
 * Both extend AppError (not plain Error) so handleApiError() maps them to
 * the correct HTTP status instead of falling through to a generic 500.
 */
export class DuplicateDomainError extends AppError {
  constructor(domain: string) {
    super(
      `The domain "${domain}" is already registered to another agency.`,
      409,
      "DUPLICATE_DOMAIN",
    );
  }
}

export class DomainNotFoundError extends AppError {
  constructor(domain: string) {
    super(
      `No agency is registered with the domain "${domain}". Ask your agency admin to register first, or contact support.`,
      404,
      "DOMAIN_NOT_FOUND",
    );
  }
}

/** Throws DuplicateDomainError if the domain derived from `email` already exists. */
export async function assertDomainIsAvailable(email: string): Promise<string> {
  const domain = extractDomain(email);
  const existing = await domainRepository.findByDomain(domain);
  if (existing) {
    throw new DuplicateDomainError(domain);
  }
  return domain;
}

/**
 * Resolves the agency that owns the domain derived from `email`.
 * Used by Employee Join Request to auto-detect which agency to join.
 */
export async function resolveAgencyByEmailDomain(email: string) {
  const domain = extractDomain(email);
  const domainRecord = await domainRepository.findByDomain(domain);
  if (!domainRecord) {
    throw new DomainNotFoundError(domain);
  }
  const agency = await agencyRepository.findById(domainRecord.agencyId);
  if (!agency) {
    throw new DomainNotFoundError(domain);
  }
  return agency;
}
