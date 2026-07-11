"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { API_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";

interface PlatformFormatOption {
  key: string;
  label: string;
  aspectRatio: string;
}

const TRUST_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  TRUST_READY: "success",
  REVIEW_RECOMMENDED: "warning",
  BLOCKED: "destructive",
};

export function GenerationPanel({
  advertisementId,
  currentStyle,
  generatedAssetUrl,
  trustStatus,
  trustWarnings,
}: {
  advertisementId: string;
  currentStyle: string;
  generatedAssetUrl: string | null;
  trustStatus: string | null;
  trustWarnings: string[];
}) {
  const router = useRouter();
  const [formats, setFormats] = useState<PlatformFormatOption[]>([]);
  const [platformFormat, setPlatformFormat] = useState("generic_portrait");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(API_ROUTES.platformFormats)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.data) setFormats(body.data);
      })
      .catch(() => undefined);
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const result = await postJson(API_ROUTES.advertisementGenerate(advertisementId), { platformFormat });
    setGenerating(false);

    if (!result.ok) {
      setError(result.message ?? "Generation failed");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate Advertisement</CardTitle>
        <CardDescription>
          KAI recommends a layout for your platform and requirement — Typography or Newspaper generate fully today; Visual requires the KAI Creative Engine to be connected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not generate</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <label className="text-sm font-medium">Platform</label>
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            value={platformFormat}
            onChange={(e) => setPlatformFormat(e.target.value)}
          >
            {formats.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label} ({f.aspectRatio})
              </option>
            ))}
          </select>
        </div>

        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating…" : "Generate"}
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
          <div className="overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote image */}
            <img src={generatedAssetUrl} alt={`Generated ${currentStyle} advertisement`} className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
