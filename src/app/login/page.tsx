import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Login" };

/** Screen 4 — Login. Google Workspace, Microsoft 365, Magic Link. No passwords. */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your KAI Ads account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LoginForm />
          <p className="text-center text-sm text-muted-foreground">
            New agency?{" "}
            <Link href={APP_ROUTES.register} className="font-medium text-primary hover:underline">
              Register
            </Link>{" "}
            ·{" "}
            <Link href={APP_ROUTES.join} className="font-medium text-primary hover:underline">
              Join existing agency
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
