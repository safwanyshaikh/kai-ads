"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AdvertisementContentForm,
  EMPTY_ADVERTISEMENT_CONTENT,
} from "@/components/advertisement/advertisement-content-form";
import { StyleSelector } from "@/components/advertisement/style-selector";
import { AdvertisementPreview } from "@/components/advertisement/advertisement-preview";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";
import { extractionResultSchema } from "@/server/ai/extraction-result.schema";
import { extractionResultToFormValues } from "@/lib/extraction-to-form";

type Step = "extracting" | "review" | "style" | "preview";

interface DraftWorkspaceProps {
  draftId: string;
  sourceType: string;
  hasRawText: boolean;
  initialStatus: string;
}

/**
 * Screens: AI Extraction Review -> Style Selection -> Preview -> Save.
 * Consolidated into one page since all four steps edit a single Draft
 * resource — each step still persists to its own API endpoint so the
 * work isn't lost, matching "Everything editable" and giving Advertisement
 * Draft a real backing record rather than client-only wizard state.
 */
export function DraftWorkspace({ draftId, sourceType, hasRawText, initialStatus }: DraftWorkspaceProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    initialStatus === "UPLOADED" && hasRawText ? "extracting" : "review",
  );
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [reviewedData, setReviewedData] = useState<CreateAdvertisementInput>(
    EMPTY_ADVERTISEMENT_CONTENT,
  );
  const [style, setStyle] = useState<"VISUAL" | "TYPOGRAPHY" | "NEWSPAPER">("VISUAL");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (step !== "extracting") return;

    (async () => {
      const result = await postJson<{
        status: string;
        extractionError?: string;
        extractedData?: unknown;
      }>(API_ROUTES.advertisementDraftExtract(draftId));

      if (result.ok && result.data?.status === "EXTRACTION_FAILED") {
        setExtractionMessage(
          result.data.extractionError ??
            "AI extraction is not available yet — enter the advertisement details manually.",
        );
      } else if (result.ok && result.data?.status === "EXTRACTED") {
        // Sprint 006 Bug 004: this is the wiring that was missing entirely
        // — a successful extraction never reached the review form before.
        const parsed = extractionResultSchema.safeParse(result.data.extractedData);
        if (parsed.success) {
          setReviewedData((current) => ({
            ...current,
            ...extractionResultToFormValues(parsed.data),
          }));
        } else {
          setExtractionMessage(
            "AI extraction completed but returned an unexpected shape — enter the advertisement details manually.",
          );
        }
      } else if (!result.ok) {
        setExtractionMessage(result.message ?? "AI extraction is not available yet.");
      }
      setStep("review");
    })();
  }, [step, draftId]);

  async function handleReviewSubmit(values: CreateAdvertisementInput) {
    setError(null);
    const result = await postJson(API_ROUTES.advertisementDraftReview(draftId), {
      reviewedData: values,
    });
    if (!result.ok) {
      setError(result.message ?? "Could not save your review");
      return;
    }
    setReviewedData(values);
    setStyle(values.style ?? "VISUAL");
    setStep("style");
  }

  async function handleStyleContinue() {
    setError(null);
    const result = await postJson(API_ROUTES.advertisementDraftStyle(draftId), { style });
    if (!result.ok) {
      setError(result.message ?? "Could not save the selected style");
      return;
    }
    setStep("preview");
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    const result = await postJson<{ id: string }>(API_ROUTES.advertisementDraftSave(draftId));
    setSaving(false);

    if (!result.ok) {
      setError(result.message ?? "Could not save this advertisement");
      return;
    }
    router.push(APP_ROUTES.advertisementDetail(result.data!.id));
  }

  async function handleDiscard() {
    await postJson(API_ROUTES.advertisementDraftDiscard(draftId));
    router.push(APP_ROUTES.advertisements);
  }

  const steps: { key: Step; label: string }[] = [
    { key: "review", label: "1. Review" },
    { key: "style", label: "2. Style" },
    { key: "preview", label: "3. Preview & Save" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        {steps.map((s) => (
          <span
            key={s.key}
            className={
              step === s.key
                ? "font-semibold text-foreground"
                : "text-muted-foreground"
            }
          >
            {s.label}
          </span>
        ))}
        <span className="ml-auto">
          <Button type="button" variant="ghost" size="sm" onClick={handleDiscard}>
            Discard
          </Button>
        </span>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === "extracting" && (
        <Alert>
          <AlertTitle>Running AI Extraction Review…</AlertTitle>
          <AlertDescription>
            Analyzing the {sourceType === "PASTE_TEXT" ? "pasted text" : "uploaded file"} for
            positions, industry, country, and interview details.
          </AlertDescription>
        </Alert>
      )}

      {step === "review" && (
        <div className="space-y-4">
          {extractionMessage && (
            <Alert>
              <AlertTitle>AI Extraction Review</AlertTitle>
              <AlertDescription>{extractionMessage}</AlertDescription>
            </Alert>
          )}
          <AdvertisementContentForm
            defaultValues={reviewedData}
            onSubmit={handleReviewSubmit}
            submitLabel="Continue to Style Selection"
          />
        </div>
      )}

      {step === "style" && (
        <div className="space-y-6">
          <StyleSelector value={style} onChange={setStyle} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("review")}>
              Back
            </Button>
            <Button onClick={handleStyleContinue}>Continue to Preview</Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-6">
          <AdvertisementPreview data={{ ...reviewedData, style }} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("style")}>
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Advertisement"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
