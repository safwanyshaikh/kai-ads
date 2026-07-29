import { AppError } from "@/lib/errors";

/**
 * User-facing AI failure messages.
 *
 * These messages are serialized to the browser by handleApiError, so they
 * must never name a provider, a model, an environment variable, or an
 * account/billing condition. "the OpenAI account has run out of
 * quota/credit" reached a real agency-facing screen; a recruiter can do
 * nothing with that, and it exposes which vendor KAI runs on and the state
 * of its billing.
 *
 * Operator detail belongs in `operatorDetail`, which is logged server-side
 * and never serialized, and in the stable `code`, which monitoring can
 * alert on without the message carrying the detail.
 */
const UNAVAILABLE = "KAI Intelligence is temporarily unavailable. Please try again later.";

/** No AI provider is configured for this stage. */
export class AiNotConfiguredError extends AppError {
  readonly operatorDetail = "No AI provider key configured (GEMINI_*_API_KEY or OPENAI_API_KEY).";
  constructor() {
    super(UNAVAILABLE, 503, "AI_NOT_CONFIGURED");
  }
}

/** The provider took too long to respond. */
export class AiTimeoutError extends AppError {
  readonly operatorDetail = "Upstream AI provider timed out.";
  constructor() {
    super("KAI Intelligence took too long to respond. Please try again.", 504, "AI_TIMEOUT");
  }
}

/**
 * The provider returned HTTP 429. Providers overload this status for two
 * different conditions: transient per-minute throttling, which clears by
 * waiting, and an exhausted account quota, which does not.
 *
 * The distinction is preserved in `code` and `operatorDetail` for
 * monitoring and support, but not in the user-facing message: a recruiter
 * cannot raise a billing limit, and telling them which vendor is out of
 * credit exposes internal detail without helping them.
 */
export class AiRateLimitError extends AppError {
  readonly operatorDetail: string;
  constructor(providerCode?: string) {
    const isQuotaExhausted = providerCode === "insufficient_quota";
    super(
      isQuotaExhausted
        ? UNAVAILABLE
        : "KAI Intelligence is busy right now. Please try again in a moment.",
      429,
      isQuotaExhausted ? "AI_QUOTA_EXHAUSTED" : "AI_RATE_LIMITED",
    );
    this.operatorDetail = isQuotaExhausted
      ? "Provider account quota/credit exhausted — retrying will not help until billing is topped up."
      : "Provider rate limit (requests per minute) hit.";
  }
}

/**
 * The provider responded, but not in the shape the pipeline requires.
 *
 * `details` frequently contains the raw upstream payload — a live run
 * produced `{"error":{"code":404,"message":"This model
 * models/gemini-2.5-flash is no longer available..."}}`. That must never
 * reach a browser, so it is kept on `operatorDetail` for logs only.
 */
export class AiInvalidResponseError extends AppError {
  readonly operatorDetail: string;
  constructor(details?: string) {
    super(UNAVAILABLE, 502, "AI_INVALID_RESPONSE");
    this.operatorDetail = details
      ? `AI provider returned an unexpected response: ${details}`
      : "AI provider returned an unexpected response.";
  }
}

/** The uploaded file's type/size/content isn't something the engine can process. */
export class UnsupportedDocumentError extends AppError {
  constructor(message: string) {
    super(message, 422, "UNSUPPORTED_DOCUMENT");
  }
}
