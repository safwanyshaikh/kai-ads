import { AppError } from "@/lib/errors";

/** OPENAI_API_KEY is not set. */
export class AiNotConfiguredError extends AppError {
  constructor() {
    super(
      "The KAI Intelligence Engine is not configured yet. Set OPENAI_API_KEY to enable AI extraction.",
      503,
      "AI_NOT_CONFIGURED",
    );
  }
}

/** The provider took too long to respond. */
export class AiTimeoutError extends AppError {
  constructor() {
    super("The KAI Intelligence Engine took too long to respond. Try again.", 504, "AI_TIMEOUT");
  }
}

/**
 * The provider returned HTTP 429. OpenAI overloads this status for two
 * different conditions with the same HTTP code but a different `code`
 * field in the response body — they need different user-facing messages
 * because only one of them clears by waiting:
 *   - "rate_limit_exceeded" — transient, requests-per-minute throttling.
 *     Waiting genuinely fixes it.
 *   - "insufficient_quota" — the OpenAI account's billing limit/credit is
 *     exhausted. Retrying changes nothing until the account is topped up;
 *     telling the user "try again in a moment" here is actively wrong.
 */
export class AiRateLimitError extends AppError {
  constructor(providerCode?: string) {
    const isQuotaExhausted = providerCode === "insufficient_quota";
    super(
      isQuotaExhausted
        ? "The KAI Intelligence Engine is unavailable — the OpenAI account has run out of quota/credit. This will not resolve by retrying; the account's billing limit needs to be raised or credit added."
        : "The KAI Intelligence Engine is temporarily busy. Try again in a moment.",
      429,
      isQuotaExhausted ? "AI_QUOTA_EXHAUSTED" : "AI_RATE_LIMITED",
    );
  }
}

/** The provider responded, but the response didn't match the required structured-output schema. */
export class AiInvalidResponseError extends AppError {
  constructor(details?: string) {
    super(
      `The KAI Intelligence Engine returned an unexpected response${details ? `: ${details}` : "."}`,
      502,
      "AI_INVALID_RESPONSE",
    );
  }
}

/** The uploaded file's type/size/content isn't something the engine can process. */
export class UnsupportedDocumentError extends AppError {
  constructor(message: string) {
    super(message, 422, "UNSUPPORTED_DOCUMENT");
  }
}
