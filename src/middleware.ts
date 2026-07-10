import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { APP_ROUTES } from "@/lib/constants";

/**
 * Route guard middleware.
 *
 * Runs on the edge — cannot touch Prisma/Postgres directly, so it only
 * checks for the PRESENCE of a valid session cookie (fast, no DB round
 * trip). Full session + RBAC verification (role, status, agencyId) happens
 * server-side in each page/route via requireCurrentUser() + assertPermission().
 * This two-layer model is the standard, recommended Better Auth pattern.
 */
const PROTECTED_PREFIXES = [
  APP_ROUTES.dashboard,
  APP_ROUTES.adminAgencies,
];

const PUBLIC_ONLY_PREFIXES = [APP_ROUTES.login];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isPublicOnly = PUBLIC_ONLY_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL(APP_ROUTES.login, request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicOnly && sessionCookie) {
    return NextResponse.redirect(new URL(APP_ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
  ],
};
