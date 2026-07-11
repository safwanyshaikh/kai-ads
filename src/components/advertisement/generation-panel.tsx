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

interface ThemeOption {
  key: string;
  label: string;
  description: string;
}

const STYLE_OPTIONS = [
  { value: "" as const, label: "Let KAI Recommend" },
  { value: "VISUAL" as const, label: "Visual" },
  { value: "TYPOGRAPHY" as const, label: "Typography" },
  { value: "NEWSPAPER" as const, label: "DTP / Newspaper" },
];

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
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [platformFormat, setPlatformFormat] = useState("generic_portrait");
  const [style, setStyle] = useState<"" | "VISUAL" | "TYPOGRAPHY" | "NEWSPAPER">("");
  const [theme, setTheme] = useState("");
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

  useEffect(() => {
    const query = style ? `?style=${style}` : `?style=${currentStyle}`;
    fetch(`${API_ROUTES.themeFamilies}${query}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.data) setThemes(body.data);
      })
      .catch(() => undefined);
  }, [style, currentStyle]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const result = await postJson(API_ROUTES.advertisementGenerate(advertisementId), {
      platformFormat,
      style: style || undefined,
      theme: theme || undefined,
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
          Choose a platform, optionally override the style and theme, then generate. Visual, Typography, and
          DTP/Newspaper all produce a finished, downloadable advertisement.
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

        <div>
          <label className="text-sm font-medium">Style</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={style === opt.value ? "default" : "outline"}
                onClick={() => setStyle(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {themes.length > 0 && (
          <div>
            <label className="text-sm font-medium">Theme</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={theme === "" ? "default" : "outline"}
                onClick={() => setTheme("")}
              >
                Default
              </Button>
              {themes.map((t) => (
                <Button
                  key={t.key}
                  type="button"
                  size="sm"
                  variant={theme === t.key ? "default" : "outline"}
                  onClick={() => setTheme(t.key)}
                  title={t.description}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating your advertisement…" : "Generate"}
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
              <img src={generatedAssetUrl} alt={`Generated ${currentStyle} advertisement`} className="w-full" />
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
