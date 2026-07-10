import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createLogger } from "@/lib/logger";
import { ForbiddenError } from "@/lib/rbac";

const log = createLogger("api-error-handler");

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} not found`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Single place every API route funnels errors through.
 * Guarantees a consistent JSON error shape and consistent logging.
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: error.message } },
      { status: 403 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }

  if (error instanceof Error) {
    log.error({ err: error }, "Unhandled API error");
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }

  log.error({ err: error }, "Unhandled non-Error thrown");
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
    { status: 500 },
  );
}
