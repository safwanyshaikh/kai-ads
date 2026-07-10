import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Check Your Email" };

/**
 * Landing spot for people who navigate to /login/verify directly
 * (e.g. re-opened a bookmark). Actual token verification is handled by
 * Better Auth's own /api/auth/magic-link/verify endpoint, which redirects
 * straight to the dashboard on success. If it fails, it redirects here
 * with ?error=.
 */
export default async function LoginVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">
            {error ? "Sign-in link problem" : "Check your inbox"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Link expired or already used</AlertTitle>
              <AlertDescription>
                Magic links expire after 15 minutes and can only be used
                once. Request a new one to sign in.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click the sign-in link we emailed you to continue. You can
              close this tab.
            </p>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link href={APP_ROUTES.login}>Back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
