import { describe, expect, it } from "vitest";
import {
  AiNotConfiguredError,
  AiTimeoutError,
  AiRateLimitError,
  AiInvalidResponseError,
  UnsupportedDocumentError,
} from "@/server/ai/openai/errors";
import { AppError } from "@/lib/errors";

describe("AI error hierarchy — Error Handling", () => {
  it("AiNotConfiguredError maps to 503 (missing API key)", () => {
    const error = new AiNotConfiguredError();
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("AI_NOT_CONFIGURED");
  });

  it("AiTimeoutError maps to 504 (provider timeout)", () => {
    const error = new AiTimeoutError();
    expect(error.statusCode).toBe(504);
    expect(error.code).toBe("AI_TIMEOUT");
  });

  it("AiRateLimitError maps to 429 (rate limit)", () => {
    const error = new AiRateLimitError();
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("AI_RATE_LIMITED");
  });

  it("AiInvalidResponseError maps to 502 (malformed structured output)", () => {
    const error = new AiInvalidResponseError("schema mismatch");
    expect(error.statusCode).toBe(502);
    expect(error.message).toContain("schema mismatch");
  });

  it("UnsupportedDocumentError maps to 422 with a caller-supplied reason", () => {
    const error = new UnsupportedDocumentError("This PDF could not be read.");
    expect(error.statusCode).toBe(422);
    expect(error.message).toBe("This PDF could not be read.");
  });

  it("every AI error extends AppError so handleApiError maps it correctly, never falling through to a generic 500", () => {
    const errors = [
      new AiNotConfiguredError(),
      new AiTimeoutError(),
      new AiRateLimitError(),
      new AiInvalidResponseError(),
      new UnsupportedDocumentError("bad file"),
    ];
    for (const error of errors) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).not.toBe(500);
    }
  });
});
