"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { AdvertisementContentForm, EMPTY_ADVERTISEMENT_CONTENT } from "@/components/advertisement/advertisement-content-form";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { postJson } from "@/lib/api-client";
import type { CreateAdvertisementInput } from "@/lib/validations/advertisement";
import { extractionResultSchema } from "@/server/ai/extraction-result.schema";
import { planAutoPublish } from "@/lib/auto-publish";

type Step =
  | "extracting"
  | "generating"
  | "recovery"
  | "manual";

interface DraftWorkspaceProps {
  draftId: string;
  sourceType: string;
  hasRawText: boolean;
  initialStatus: string;
}

export function DraftWorkspace({
  draftId,
  sourceType,
  hasRawText,
  initialStatus,
}: DraftWorkspaceProps) {
  const router =
    useRouter();

  const [step, setStep] =
    useState<Step>(
      initialStatus === "UPLOADED" &&
        (hasRawText ||
          sourceType !== "PASTE_TEXT")
        ? "extracting"
        : "manual",
    );

  const [
    pipelineMessage,
    setPipelineMessage,
  ] = useState(
    "KAI is reading the complete recruitment requirement…",
  );

  const [
    fallbackReason,
    setFallbackReason,
  ] = useState<
    string | null
  >(null);

  const [
    manualDefaults,
    setManualDefaults,
  ] =
    useState<CreateAdvertisementInput>(
      EMPTY_ADVERTISEMENT_CONTENT,
    );

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const started =
    useRef(false);

  const canRetryExtraction =
    hasRawText ||
    sourceType !==
      "PASTE_TEXT";

  function handleContinueManually() {
    setFallbackReason(
      null,
    );

    setStep(
      "manual",
    );
  }

  function handleRetryExtraction() {
    setFallbackReason(
      null,
    );

    setError(null);

    started.current =
      false;

    setPipelineMessage(
      "KAI is reading the complete recruitment requirement…",
    );

    setStep(
      "extracting",
    );
  }

  useEffect(() => {
    if (
      step !==
        "extracting" ||
      started.current
    ) {
      return;
    }

    started.current =
      true;

    (async () => {
      /**
       * STEP 1
       * KAI Intelligence Extraction
       */
      const extract =
        await postJson<{
          status: string;
          extractionError?: string | null;
          extractedData?: unknown;
        }>(
          API_ROUTES.advertisementDraftExtract(
            draftId,
          ),
        );

      if (
        !extract.ok
      ) {
        const message =
          extract.message ??
          "KAI extraction request failed.";

        setFallbackReason(
          message,
        );

        setError(
          message,
        );

        setStep(
          "recovery",
        );

        return;
      }

      if (
        extract.data?.status !==
        "EXTRACTED"
      ) {
        const message =
          extract.data
            ?.extractionError ??
          "KAI could not extract a valid recruitment requirement from the supplied source.";

        setFallbackReason(
          message,
        );

        setError(
          message,
        );

        setStep(
          "recovery",
        );

        return;
      }

      /**
       * STEP 2
       * Validate the structured extraction.
       */
      const parsed =
        extractionResultSchema.safeParse(
          extract.data.extractedData,
        );

      if (
        !parsed.success
      ) {
        const issueSummary =
          parsed.error.issues
            .map(
              (issue) =>
                `${issue.path.join(".")}: ${issue.message}`,
            )
            .join(
              "; ",
            );

        const message =
          `KAI extraction returned invalid structured data. ${issueSummary}`;

        setFallbackReason(
          message,
        );

        setError(
          message,
        );

        setStep(
          "recovery",
        );

        return;
      }

      /**
       * STEP 3
       * Decide whether enough grounded facts exist.
       */
      const plan =
        planAutoPublish(
          parsed.data,
        );

      if (
        plan.mode ===
        "manual"
      ) {
        /**
         * Only genuine missing core facts may stop
         * automatic generation.
         */
        setFallbackReason(
          plan.reason,
        );

        setManualDefaults({
          ...EMPTY_ADVERTISEMENT_CONTENT,
          ...plan.partial,
        });

        setStep(
          "manual",
        );

        return;
      }

      /**
       * STEP 4
       * Persist the extracted requirement.
       */
      setStep(
        "generating",
      );

      setPipelineMessage(
        "KAI has understood the requirement. Building the recruitment advertisement…",
      );

      const review =
        await postJson(
          API_ROUTES.advertisementDraftReview(
            draftId,
          ),
          {
            reviewedData:
              plan.input,
          },
        );

      if (
        !review.ok
      ) {
        const message =
          review.message ??
          "KAI understood the requirement but could not save the extracted facts.";

        setError(
          message,
        );

        setManualDefaults(
          plan.input,
        );

        setFallbackReason(
          message,
        );

        setStep(
          "manual",
        );

        return;
      }

      /**
       * STEP 5
       * Create the Advertisement entity.
       */
      const saved =
        await postJson<{
          id: string;
        }>(
          API_ROUTES.advertisementDraftSave(
            draftId,
          ),
        );

      if (
        !saved.ok ||
        !saved.data?.id
      ) {
        const message =
          saved.message ??
          "KAI extracted the requirement but could not create the advertisement record.";

        setError(
          message,
        );

        setManualDefaults(
          plan.input,
        );

        setFallbackReason(
          message,
        );

        setStep(
          "manual",
        );

        return;
      }

      /**
       * STEP 6
       * Generate immediately.
       *
       * A generation failure is not a reason to
       * throw the recruiter into data entry.
       *
       * The advertisement already exists and the
       * canvas can retry generation.
       */
      setPipelineMessage(
        "KAI is creating the visual campaign with Gemini and applying the verified recruitment facts…",
      );

      const generated =
        await postJson(
          API_ROUTES.advertisementGenerate(
            saved.data.id,
          ),
          {
            platformFormat:
              "generic_portrait",
          },
        );

      /**
       * Generation failure does NOT mean extraction failed.
       *
       * Land the recruiter on the Advertisement Canvas
       * where the generation panel can retry.
       */
      if (
        !generated.ok
      ) {
        router.push(
          APP_ROUTES.advertisementDetail(
            saved.data.id,
          ),
        );

        return;
      }

      /**
       * STEP 7
       * Advertisement ready.
       */
      router.push(
        APP_ROUTES.advertisementDetail(
          saved.data.id,
        ),
      );
    })().catch(
      (unexpectedError) => {
        const message =
          unexpectedError instanceof
          Error
            ? unexpectedError.message
            : "Unexpected KAI pipeline error.";

        setError(
          message,
        );

        setFallbackReason(
          message,
        );

        setStep(
          "recovery",
        );
      },
    );
  }, [
    step,
    draftId,
    router,
  ]);

  async function handleManualSubmit(
    values: CreateAdvertisementInput,
  ) {
    setError(null);
    setSaving(true);

    const review =
      await postJson(
        API_ROUTES.advertisementDraftReview(
          draftId,
        ),
        {
          reviewedData:
            values,
        },
      );

    if (
      !review.ok
    ) {
      setSaving(false);

      setError(
        review.message ??
          "Could not save the details.",
      );

      return;
    }

    const saved =
      await postJson<{
        id: string;
      }>(
        API_ROUTES.advertisementDraftSave(
          draftId,
        ),
      );

    if (
      !saved.ok ||
      !saved.data?.id
    ) {
      setSaving(false);

      setError(
        saved.message ??
          "Could not create the advertisement.",
      );

      return;
    }

    await postJson(
      API_ROUTES.advertisementGenerate(
        saved.data.id,
      ),
      {
        platformFormat:
          "generic_portrait",
      },
    );

    router.push(
      APP_ROUTES.advertisementDetail(
        saved.data.id,
      ),
    );
  }

  async function handleDiscard() {
    await postJson(
      API_ROUTES.advertisementDraftDiscard(
        draftId,
      ),
    );

    router.push(
      APP_ROUTES.advertisements,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center text-sm">
        <span className="font-semibold">
          {step ===
          "manual"
            ? "Complete the missing details"
            : step ===
                "recovery"
              ? "KAI needs attention"
              : "Creating your advertisement"}
        </span>

        <span className="ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={
              handleDiscard
            }
            disabled={
              saving
            }
          >
            Discard
          </Button>
        </span>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>
            KAI pipeline error
          </AlertTitle>

          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {(
        step ===
          "extracting" ||
        step ===
          "generating"
      ) && (
        <Alert>
          <AlertTitle>
            {step ===
            "extracting"
              ? "KAI is reading your requirement…"
              : "KAI is designing your advertisement…"}
          </AlertTitle>

          <AlertDescription>
            {
              pipelineMessage
            }
          </AlertDescription>
        </Alert>
      )}

      {step ===
        "recovery" && (
        <div className="rounded-lg border p-6 text-center">
          <p className="font-semibold">
            KAI could not complete
            the automatic
            preparation.
          </p>

          {fallbackReason && (
            <p className="mt-2 text-sm text-muted-foreground">
              {
                fallbackReason
              }
            </p>
          )}

          <div className="mt-4 flex justify-center gap-2">
            {canRetryExtraction && (
              <Button
                type="button"
                onClick={
                  handleRetryExtraction
                }
              >
                Retry
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={
                handleContinueManually
              }
            >
              Continue Manually
            </Button>
          </div>
        </div>
      )}

      {step ===
        "manual" && (
        <div className="space-y-4">
          {fallbackReason && (
            <Alert>
              <AlertTitle>
                KAI has preserved
                the confirmed facts
              </AlertTitle>

              <AlertDescription>
                {
                  fallbackReason
                }
              </AlertDescription>
            </Alert>
          )}

          <AdvertisementContentForm
            defaultValues={
              manualDefaults
            }
            onSubmit={
              handleManualSubmit
            }
            submitLabel={
              saving
                ? "Creating…"
                : "Create Advertisement"
            }
          />
        </div>
      )}
    </div>
  );
}
