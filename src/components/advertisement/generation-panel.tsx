"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

/** The one production pipeline's default canvas size — no format picker; KAI decides. */
const DEFAULT_PLATFORM_FORMAT = "generic_portrait";

const TRUST_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const result = await postJson(API_ROUTES.advertisementGenerate(advertisementId), {
      platformFormat: DEFAULT_PLATFORM_FORMAT,
    });
    setGenerating(false);

    if (!result.ok) {
      setError(result.message ?? "Generation failed");
      return;
    }
    router.refresh();
  }

  function handleDownload(format: "png" | "jpg" | "pdf") {
    window.open(API_ROUTES.advertisementExport(advertisementId, format), "_blank");
  }

  const canDownload = generatedAssetUrl && trustStatus !== "BLOCKED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate Advertisement</CardTitle>
        <CardDescription>
          KAI writes the creative brief and GPT Image composes the finished advertisement in one pass.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not generate</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating your advertisement…" : generatedAssetUrl ? "Regenerate" : "Generate"}
        </Button>

        {trustStatus && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Trust Status</span>
              <Badge variant={TRUST_VARIANT[trustStatus] ?? "outline"}>{trustStatus.replace(/_/g, " ")}</Badge>
            </div>
            {trustWarnings.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {trustWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {generatedAssetUrl && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote image */}
              <img src={generatedAssetUrl} alt="Generated advertisement" className="w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!canDownload} onClick={() => handleDownload("png")}>
                Download PNG
              </Button>
              <Button size="sm" variant="outline" disabled={!canDownload} onClick={() => handleDownload("jpg")}>
                Download JPG
              </Button>
              <Button size="sm" variant="outline" disabled={!canDownload} onClick={() => handleDownload("pdf")}>
                Download PDF
              </Button>
            </div>
            {!canDownload && trustStatus === "BLOCKED" && (
              <p className="text-xs text-destructive">
                Download is blocked until the trust check issues above are resolved and the advertisement is
                regenerated.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
