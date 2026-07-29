"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Error boundary for the Create Advertisement screen.
 *
 * Without one, an unhandled render error here takes out the whole route
 * and Next.js shows its own error surface — which in production is blank
 * and in development is a stack trace. This is the first screen a new
 * agency sees, so it must always degrade into something recoverable.
 *
 * `error.message` is deliberately not rendered: it is arbitrary upstream
 * text and has previously carried provider and model names.
 */
export default function DraftError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Create Advertisement screen failed to render", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-10">
      <Alert variant="destructive">
        <AlertTitle>This screen could not be loaded</AlertTitle>
        <AlertDescription>
          Something went wrong while preparing your advertisement. Your draft has not been lost.
        </AlertDescription>
      </Alert>
      <div className="flex gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/advertisements">Back to advertisements</Link>
        </Button>
      </div>
    </div>
  );
}
