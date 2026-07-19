"use client";

/**
 * Every API route funnels errors through handleApiError() (src/lib/errors.ts),
 * which always returns `{ error: { code, message, details? } }`. This is the
 * single client-side counterpart: parse a Response into a consistent result,
 * used by every form/action component instead of each one re-implementing
 * "fetch, check .ok, parse the error envelope, fall back to a default message".
 */
interface ApiResult<T = undefined> {
  ok: boolean;
  data?: T;
  message?: string;
}

async function sendJson<T>(method: "POST" | "PATCH", url: string, body?: unknown): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const parsed = await response.json().catch(() => null);

  if (!response.ok) {
    return { ok: false, message: parsed?.error?.message ?? "Something went wrong" };
  }
  return { ok: true, data: parsed?.data as T };
}

export async function postJson<T = undefined>(url: string, body?: unknown): Promise<ApiResult<T>> {
  return sendJson<T>("POST", url, body);
}

/** Same envelope as postJson — used by the canvas block editor against PATCH /api/advertisements/[id]. */
export async function patchJson<T = undefined>(url: string, body?: unknown): Promise<ApiResult<T>> {
  return sendJson<T>("PATCH", url, body);
}
