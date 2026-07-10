import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Pending Approval" };

/** Screen 3 — Pending Approval (Functional Spec). Purely informational. */
export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Your agency is under verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Thank you for registering. A KAI Super Admin is reviewing your
            details. You will not have platform access until your agency is
            approved. We&apos;ll notify your official business email once a
            decision is made.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href={APP_ROUTES.home}>Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
