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

/** The provider returned HTTP 429. */
export class AiRateLimitError extends AppError {
  constructor() {
    super(
      "The KAI Intelligence Engine is temporarily busy. Try again in a moment.",
      429,
      "AI_RATE_LIMITED",
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
