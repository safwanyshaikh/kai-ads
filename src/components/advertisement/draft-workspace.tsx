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

type Step = "extracting" | "generating" | "manual";

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
        setFallbackReason(
          extract.data?.extractionError ??
            extract.message ??
            "AI extraction is not available — enter the advertisement details manually.",
        );
        setStep("manual");
        return;
      }

      const parsed = extractionResultSchema.safeParse(extract.data.extractedData);
      if (!parsed.success) {
        setFallbackReason("AI extraction returned an unexpected shape — enter the details manually.");
        setStep("manual");
        return;
      }

      // 2. Decide: enough grounded facts for a real advertisement?
      const plan = planAutoPublish(parsed.data);
      if (plan.mode === "manual") {
        setFallbackReason(plan.reason);
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
          {step === "manual" ? "Complete the missing details" : "Creating your advertisement"}
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
            {step === "extracting" ? "Running AI Extraction…" : "Building your advertisement…"}
          </AlertTitle>
          <AlertDescription>{pipelineMessage}</AlertDescription>
        </Alert>
      )}

      {step === "manual" && (
        <div className="space-y-4">
          {fallbackReason && (
            <Alert>
              <AlertTitle>A few details are needed</AlertTitle>
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
