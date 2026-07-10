import Link from "next/link";
import type { Metadata } from "next";
import { RegisterAgencyForm } from "@/components/agency/register-agency-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Register Agency" };

export default function RegisterAgencyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Register Your Agency</CardTitle>
          <CardDescription>
            Submit your agency details for verification. You will not have
            platform access until KAI approves your registration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterAgencyForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href={APP_ROUTES.login} className="font-medium text-primary hover:underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
