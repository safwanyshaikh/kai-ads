import Link from "next/link";
import type { Metadata } from "next";
import { JoinRequestForm } from "@/components/agency/join-request-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Join Your Agency" };

/** Employee Join Request — Sprint 001. Public page, no auth required. */
export default function JoinPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Join Your Agency</CardTitle>
          <CardDescription>
            Already have colleagues on KAI Ads? Enter your business email and
            we&apos;ll match you to your agency for admin approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JoinRequestForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already approved?{" "}
            <Link href={APP_ROUTES.login} className="font-medium text-primary hover:underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
