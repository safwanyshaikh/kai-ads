import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Handlers are built per-request (not at module scope) so constructing the
// Better Auth instance — and its getEnv() validation — happens at request
// time, not during Next.js's build-time "Collecting page data" step. See
// buildAuth() in @/lib/auth for why.
export async function GET(request: Request) {
  const { GET: handler } = toNextJsHandler(getAuth());
  return handler(request);
}

export async function POST(request: Request) {
  const { POST: handler } = toNextJsHandler(getAuth());
  return handler(request);
}
