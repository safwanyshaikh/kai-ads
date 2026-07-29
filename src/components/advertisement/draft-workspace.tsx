"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AdvertisementContentForm,
  EMPTY_ADVERTISEMENT_CONTENT,
} from "@/components/advertisement/advertisement-content-form";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";
import { extractionResultSchema } from "@/server/ai/extraction-result.schema";
import { planAutoPublish } from "@/lib/auto-publish";

/**
 * "recovery" is a presentation-only state between a failed extraction and
 * the manual editor. The editor is the fallback experience, not the
 * default one — landing a recruiter straight in a blank 30-field form
 * makes KAI look like a data-entry application rather than an assistant
 * that just tried to do the work for them.
 */
type Step = "extracting" | "generating" | "recovery" | "manual";

interface DraftWorkspaceProps {
  draftId: string;
  sourceType: string;
  hasRawText: boolean;
  initialStatus: string;
}

/**
 * Sprint 006 workflow replacement — there is NO Review form step anymore.
 *
 *   Paste Requirement → AI Extraction → Truth Brain → Creative Director
 *   → Generate Advertisement → Advertisement Canvas.
 *
 * The AI populates everything; this component's whole job is to drive
 * that pipeline automatically (extract → save reviewed data verbatim →
 * create the advertisement → kick off generation) and land the user on
 * the Advertisement Canvas, where every block is edited in place.
 *
 * The manual form survives ONLY as the exception path: when extraction
 * fails outright, or finds too few grounded facts to create a valid
 * advertisement (Truth Brain forbids inventing the missing ones), the
 * recruiter is asked for exactly what's missing. That is a failure
 * fallback, not a step in the normal flow.
 */
export function DraftWorkspace({ draftId, sourceType, hasRawText, initialStatus }: DraftWorkspaceProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    initialStatus === "UPLOADED" && (hasRawText || sourceType !== "PASTE_TEXT") ? "extracting" : "manual",
  );
  const [pipelineMessage, setPipelineMessage] = useState("Analyzing the requirement…");
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [manualDefaults, setManualDefaults] = useState<CreateAdvertisementInput>(
    EMPTY_ADVERTISEMENT_CONTENT,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const started = useRef(false);
  // Extraction is only retryable when there is source material to re-read.
  const canRetryExtraction = hasRawText || sourceType !== "PASTE_TEXT";

  function handleContinueManually() {
    setFallbackReason(null);
    setStep("manual");
  }

  function handleRetryExtraction() {
    setFallbackReason(null);
    setError(null);
    started.current = false;
    setPipelineMessage("Analyzing the requirement…");
    setStep("extracting");
  }

  useEffect(() => {
    if (step !== "extracting" || started.current) return;
    started.current = true;

    (async () => {
      // 1. AI Extraction (KAI Intelligence Engine).
      const extract = await postJson<{
        status: string;
        extractionError?: string;
        extractedData?: unknown;
      }>(API_ROUTES.advertisementDraftExtract(draftId));

      if (!extract.ok || extract.data?.status !== "EXTRACTED") {
        setStep("recovery");
        return;
      }

      const parsed = extractionResultSchema.safeParse(extract.data.extractedData);
      if (!parsed.success) {
        setStep("recovery");
        return;
      }

      // 2. Decide: enough grounded facts for a real advertisement?
      const plan = planAutoPublish(parsed.data);
      if (plan.mode === "manual") {
        setFallbackReason(
          "KAI prepared what it could confirm from your requirement. Please add the remaining details below.",
        );
        setManualDefaults({ ...EMPTY_ADVERTISEMENT_CONTENT, ...plan.partial });
        setStep("manual");
        return;
      }

      // 3. Persist the AI's result as the reviewed data (verbatim — the
      //    user edits exceptions later, on the canvas) and create the
      //    advertisement record.
      setStep("generating");
      setPipelineMessage("Composing your advertisement…");

      const review = await postJson(API_ROUTES.advertisementDraftReview(draftId), {
        reviewedData: plan.input,
      });
      if (!review.ok) {
        setError(review.message ?? "Could not save the extracted details");
        setStep("manual");
        setManualDefaults({ ...EMPTY_ADVERTISEMENT_CONTENT, ...plan.input });
        return;
      }

      const saved = await postJson<{ id: string }>(API_ROUTES.advertisementDraftSave(draftId));
      if (!saved.ok || !saved.data?.id) {
        setError(saved.message ?? "Could not create the advertisement");
        setStep("manual");
        setManualDefaults({ ...EMPTY_ADVERTISEMENT_CONTENT, ...plan.input });
        return;
      }

      // 4. Generate immediately (Truth Brain → Creative Director →
      //    composition → acceptance loop all run server-side inside this
      //    call). A generation failure is NOT fatal to the workflow —
      //    the canvas page has the full generation panel to retry.
      setPipelineMessage("Generating the advertisement design…");
      await postJson(API_ROUTES.advertisementGenerate(saved.data.id), {
        platformFormat: "generic_portrait",
      });

      // 5. Land on the Advertisement Canvas.
      router.push(APP_ROUTES.advertisementDetail(saved.data.id));
    })();
  }, [step, draftId, router]);

  async function handleManualSubmit(values: CreateAdvertisementInput) {
    setError(null);
    setSaving(true);
    const review = await postJson(API_ROUTES.advertisementDraftReview(draftId), {
      reviewedData: values,
    });
    if (!review.ok) {
      setSaving(false);
      setError(review.message ?? "Could not save the details");
      return;
    }
    const saved = await postJson<{ id: string }>(API_ROUTES.advertisementDraftSave(draftId));
    if (!saved.ok || !saved.data?.id) {
      setSaving(false);
      setError(saved.message ?? "Could not create the advertisement");
      return;
    }
    await postJson(API_ROUTES.advertisementGenerate(saved.data.id), {
      platformFormat: "generic_portrait",
    });
    router.push(APP_ROUTES.advertisementDetail(saved.data.id));
  }

  async function handleDiscard() {
    await postJson(API_ROUTES.advertisementDraftDiscard(draftId));
    router.push(APP_ROUTES.advertisements);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center text-sm">
        <span className="font-semibold">
          {step === "manual"
            ? "Complete the missing details"
            : step === "recovery"
              ? "We hit a snag"
              : "Creating your advertisement"}
        </span>
        <span className="ml-auto">
          <Button type="button" variant="ghost" size="sm" onClick={handleDiscard} disabled={saving}>
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

      {(step === "extracting" || step === "generating") && (
        <Alert>
          <AlertTitle>
            {step === "extracting"
              ? "KAI is reading your requirement…"
              : "KAI is designing your advertisement…"}
          </AlertTitle>
          <AlertDescription>{pipelineMessage}</AlertDescription>
        </Alert>
      )}

      {step === "recovery" && (
        <div className="rounded-lg border p-6 text-center">
          <p className="font-semibold">KAI couldn&apos;t automatically prepare this advertisement.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You can try again, or fill in the details yourself.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {canRetryExtraction && (
              <Button type="button" onClick={handleRetryExtraction}>
                Retry
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleContinueManually}>
              Continue Manually
            </Button>
          </div>
        </div>
      )}

      {step === "manual" && (
        <div className="space-y-4">
          {fallbackReason && (
            <Alert>
              <AlertTitle>KAI has filled in what it could confirm</AlertTitle>
              <AlertDescription>{fallbackReason}</AlertDescription>
            </Alert>
          )}
          <AdvertisementContentForm
            defaultValues={manualDefaults}
            onSubmit={handleManualSubmit}
            submitLabel={saving ? "Creating…" : "Create Advertisement"}
          />
        </div>
      )}
    </div>
  );
}
