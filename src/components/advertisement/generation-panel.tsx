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
 * The tenant chooses the PRODUCT; KAI still decides the design.
 *
 * This panel used to send a hidden `generic_portrait` on every
 * request on the reasoning that format was a creative decision. It is
 * not — a newspaper classified and a social post are different things
 * an agency buys, for different places, at different prices. The
 * consequence of hiding it was that the live application produced a
 * social poster for everyone, and the DTP compositor, though built
 * and tested, could not be reached from the product at all.
 *
 * What stays hidden is everything genuinely internal: composition,
 * hierarchy, typography, colour treatment, image direction. The
 * recruiter picks what they are buying, not how it is laid out.
 */
type OutputFormat = "DTP_BW" | "DTP_COLOUR" | "SOCIAL";

/** The platform format the existing social pipeline expects. */
const SOCIAL_PLATFORM_FORMAT = "generic_portrait";

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

  /** null until the tenant chooses — there is no default. */
  const [outputFormat, setOutputFormat] =
    useState<OutputFormat | null>(null);

  const [dtpSelected, setDtpSelected] =
    useState(false);

  async function handleGenerate() {
    if (generating) return;

    if (!outputFormat) {
      setError("Select an advertisement format.");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      /**
       * The chosen product, explicitly. Social carries the platform
       * format its existing pipeline expects; DTP carries none,
       * because the classified compositor works in physical
       * centimetres rather than platform presets.
       */
      const result = await postJson(
        API_ROUTES.advertisementGenerate(
          advertisementId,
        ),
        outputFormat === "SOCIAL"
          ? {
              outputFormat,
              platformFormat: SOCIAL_PLATFORM_FORMAT,
            }
          : { outputFormat },
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
            ? "Choose a format and regenerate to produce a different advertisement from the same approved requirement."
            : "Choose what you are publishing. KAI composes it from the verified recruitment facts."}
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

        <div className="space-y-3">
          <p className="text-sm font-medium">
            Advertisement format
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={dtpSelected ? "default" : "outline"}
              onClick={() => {
                setDtpSelected(true);
                setOutputFormat(null);
                setError(null);
              }}
            >
              DTP / Newspaper
            </Button>

            <Button
              type="button"
              variant={outputFormat === "SOCIAL" ? "default" : "outline"}
              onClick={() => {
                setDtpSelected(false);
                setOutputFormat("SOCIAL");
                setError(null);
              }}
            >
              Social Media
            </Button>
          </div>
        </div>

        {dtpSelected && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              DTP style
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={outputFormat === "DTP_BW" ? "default" : "outline"}
                onClick={() => {
                  setOutputFormat("DTP_BW");
                  setError(null);
                }}
              >
                Black &amp; White
              </Button>

              <Button
                type="button"
                variant={outputFormat === "DTP_COLOUR" ? "default" : "outline"}
                onClick={() => {
                  setOutputFormat("DTP_COLOUR");
                  setError(null);
                }}
              >
                Colour
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating || !outputFormat}
            className="w-full sm:w-auto"
          >
            {generating
              ? "KAI is creating your advertisement…"
              : generatedAssetUrl
                ? "Regenerate Advertisement"
                : "Generate Advertisement"}
          </Button>

          <p className="text-xs text-muted-foreground">
            {outputFormat
              ? "KAI composes the layout, hierarchy and typography from the approved requirement."
              : "Select an advertisement format."}
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
