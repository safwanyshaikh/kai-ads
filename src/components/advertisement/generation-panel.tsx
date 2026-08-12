"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Badge,
} from "@/components/ui/badge";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

/**
 * KAI decides the actual output format internally.
 *
 * The recruiter does not need to choose:
 * - platform
 * - dimensions
 * - style
 * - colour theme
 * - layout
 * - image composition
 *
 * These are creative/system decisions.
 *
 * The existing API still requires a platformFormat field, so the
 * production default is sent invisibly.
 */
const DEFAULT_PLATFORM_FORMAT = "generic_portrait";

const TRUST_VARIANT: Record<
  string,
  "success" | "warning" | "destructive"
> = {
  TRUST_READY: "success",
  REVIEW_RECOMMENDED: "warning",
  BLOCKED: "destructive",
};

export function GenerationPanel({
  advertisementId,
  generatedAssetUrl,
  trustStatus,
  trustWarnings,
}: {
  advertisementId: string;
  generatedAssetUrl: string | null;
  trustStatus: string | null;
  trustWarnings: string[];
}) {
  const router = useRouter();

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function handleGenerate() {
    if (generating) return;

    setGenerating(true);
    setError(null);

    try {
      /**
       * ONE ACTION.
       *
       * The recruiter simply asks KAI to create the advertisement.
       * KAI uses the existing advertisement record as the source of truth.
       */
      const result = await postJson(
        API_ROUTES.advertisementGenerate(
          advertisementId,
        ),
        {
          platformFormat:
            DEFAULT_PLATFORM_FORMAT,
        },
      );

      if (!result.ok) {
        setError(
          result.message ??
            "KAI could not complete the advertisement. Please try again.",
        );
        return;
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "KAI could not complete the advertisement. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload(
    format: "png" | "jpg" | "pdf",
  ) {
    window.open(
      API_ROUTES.advertisementExport(
        advertisementId,
        format,
      ),
      "_blank",
    );
  }

  const canDownload =
    Boolean(generatedAssetUrl) &&
    trustStatus !== "BLOCKED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {generatedAssetUrl
            ? "Advertisement Ready"
            : "Create Advertisement"}
        </CardTitle>

        <CardDescription>
          {generatedAssetUrl
            ? "KAI has generated the advertisement from the requirement. Regenerate only when you want a new creative direction."
            : "KAI reads the requirement, decides the creative strategy, creates the visual with Gemini, applies the verified recruitment facts, and prepares the final advertisement."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>
              KAI could not generate the advertisement
            </AlertTitle>

            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full sm:w-auto"
          >
            {generating
              ? "KAI is creating your advertisement…"
              : generatedAssetUrl
                ? "Regenerate Advertisement"
                : "Generate Advertisement"}
          </Button>

          <p className="text-xs text-muted-foreground">
            No design inputs are required. KAI decides the
            format, composition, visual direction, hierarchy
            and presentation from the recruitment requirement.
          </p>
        </div>

        {trustStatus && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Trust Status
              </span>

              <Badge
                variant={
                  TRUST_VARIANT[trustStatus] ??
                  "outline"
                }
              >
                {trustStatus.replace(
                  /_/g,
                  " ",
                )}
              </Badge>
            </div>

            {trustWarnings.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {trustWarnings.map(
                  (warning, index) => (
                    <li key={index}>
                      {warning}
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        )}

        {generatedAssetUrl && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedAssetUrl}
                alt="KAI generated recruitment advertisement"
                className="block h-auto w-full"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!canDownload}
                onClick={() =>
                  handleDownload("png")
                }
              >
                Download PNG
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={!canDownload}
                onClick={() =>
                  handleDownload("jpg")
                }
              >
                Download JPG
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={!canDownload}
                onClick={() =>
                  handleDownload("pdf")
                }
              >
                Download PDF
              </Button>
            </div>

            {!canDownload &&
              trustStatus === "BLOCKED" && (
                <p className="text-xs text-destructive">
                  Download is blocked until the trust
                  issues above are resolved and the
                  advertisement is regenerated.
                </p>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
