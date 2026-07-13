import type { AdvertisementFacts, CompositionPlan, CompositionTuning } from "../archetypes";
import { archetypeUsesGeneratedImagery } from "../archetypes";
import type { VisualQaProvider, VisualQaResult } from "@/server/ai/visual-qa";
import { VISUAL_QA_PASS_THRESHOLD } from "@/server/ai/visual-qa";
import { runQrGate, runSourceFidelityGate, runTechnicalRenderGate, type GateResult } from "./gates";
import { createLogger } from "@/lib/logger";

const log = createLogger("acceptance-loop");

/** Hard iteration ceiling — the loop is bounded by construction, never by a runtime counter that could be misconfigured. */
export const MAX_ACCEPTANCE_ITERATIONS = 3;

export interface IterationRecord {
  iteration: number;
  tuning: CompositionTuning;
  regeneratedImage: boolean;
  gates: {
    sourceFidelity: GateResult;
    technicalRender: GateResult;
    qr: GateResult;
  };
  visualQa: VisualQaResult | null;
  visualQaError?: string;
}

export type AcceptanceStatus =
  /** All deterministic gates + Visual QA (>= 85) passed. */
  | "PASS"
  /** All deterministic gates passed; Visual QA Brain not configured/available — honest partial signal, never presented as a visual PASS. */
  | "PASS_DETERMINISTIC_ONLY"
  /** Visual QA stayed below threshold after the maximum iterations. */
  | "BLOCKED_VISUAL_QA"
  /** A deterministic gate failed — an AI score can never override this. */
  | "BLOCKED_DETERMINISTIC";

export interface AcceptanceOutcome {
  status: AcceptanceStatus;
  finalSvg: string;
  finalPng: Buffer;
  finalScore: number | null;
  iterations: IterationRecord[];
  blockReason?: string;
}

export interface AcceptanceLoopDeps {
  /** Brain B: compose the SVG from immutable facts + (possibly tuned) plan. */
  compose(facts: AdvertisementFacts, plan: CompositionPlan): string;
  /** Technical render step. */
  rasterize(svg: string): Promise<Buffer>;
  /** Brain C, or null when OPENAI_API_KEY is absent. */
  visualQa: VisualQaProvider | null;
  /**
   * Regenerate the decorative background with defect feedback appended
   * to the image brief. Only invoked for imagery-bearing archetypes AND
   * only when Visual QA explicitly requires REGENERATE_IMAGE — layout-only
   * corrections always reuse the existing image (cost control).
   */
  regenerateImage?: (defectNotes: string[]) => Promise<string | null>;
  /** The exact KAI verification URL the QR must round-trip to. */
  expectedQrUrl: string;
  /** Optional QR-region crop used as the phone-camera-style fallback scan. */
  cropQrRegion?: (png: Buffer) => Promise<Buffer>;
  /**
   * Visual QA pass bar. Defaults to the technical minimum
   * (VISUAL_QA_PASS_THRESHOLD, 85). The commercial launch gate runs the
   * same loop at COMMERCIAL_LAUNCH_THRESHOLD (95).
   */
  passThreshold?: number;
}

/** Commercial launch-candidate bar — stricter than the technical minimum; used by the launch acceptance run, not by everyday production generation. */
export const COMMERCIAL_LAUNCH_THRESHOLD = 95;

/**
 * Guard for the verification moat: an advertisement whose QR encodes a
 * placeholder/dev domain must never be treated as production-ready.
 */
export function isPlaceholderVerificationDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host === "example.com" ||
      host.endsWith(".example.com") ||
      host.endsWith(".example.org") ||
      host.endsWith(".example.net") ||
      host.endsWith(".test") ||
      host.endsWith(".invalid")
    );
  } catch {
    return true; // unparseable destination is never production-ready
  }
}

/**
 * The closed production loop:
 * compose → render → deterministic gates (A source fidelity, B technical,
 * C QR) → Visual QA Brain → pass or bounded correction → re-render.
 *
 * Truth boundary: `facts` is treated as immutable — corrections only ever
 * touch `plan.tuning` and the decorative background. Deterministic gates
 * run before Visual QA on EVERY iteration, and a deterministic failure
 * returns immediately without consulting (or being overridable by) the
 * vision model.
 */
export async function runAcceptanceLoop(
  facts: AdvertisementFacts,
  basePlan: CompositionPlan,
  deps: AcceptanceLoopDeps,
): Promise<AcceptanceOutcome> {
  const iterations: IterationRecord[] = [];
  let plan: CompositionPlan = { ...basePlan, tuning: { ...basePlan.tuning } };

  let finalSvg = "";
  let finalPng: Buffer = Buffer.alloc(0);
  let lastScore: number | null = null;

  for (let i = 1; i <= MAX_ACCEPTANCE_ITERATIONS; i++) {
    const record: IterationRecord = {
      iteration: i,
      tuning: { ...plan.tuning },
      regeneratedImage: false,
      gates: {
        sourceFidelity: { passed: false, failures: [] },
        technicalRender: { passed: false, failures: [] },
        qr: { passed: false, failures: [] },
      },
      visualQa: null,
    };
    iterations.push(record);

    finalSvg = deps.compose(facts, plan);

    // GATE A — source fidelity (before spending anything on rasterization or AI).
    record.gates.sourceFidelity = runSourceFidelityGate(facts, finalSvg);
    if (!record.gates.sourceFidelity.passed) {
      return blockDeterministic(record.gates.sourceFidelity, "Source fidelity gate failed");
    }

    finalPng = await deps.rasterize(finalSvg);

    // GATE B — technical render.
    record.gates.technicalRender = runTechnicalRenderGate(finalPng, {
      widthPx: plan.platformFormat.widthPx,
      heightPx: plan.platformFormat.heightPx,
    });
    if (!record.gates.technicalRender.passed) {
      return blockDeterministic(record.gates.technicalRender, "Technical render gate failed");
    }

    // GATE C — QR round-trip from the final raster.
    record.gates.qr = await runQrGate(finalPng, deps.expectedQrUrl, deps.cropQrRegion);
    if (!record.gates.qr.passed) {
      return blockDeterministic(record.gates.qr, "QR verification gate failed");
    }

    // GATE D — Visual QA Brain (only after every deterministic gate passed).
    if (!deps.visualQa) {
      return {
        status: "PASS_DETERMINISTIC_ONLY",
        finalSvg,
        finalPng,
        finalScore: null,
        iterations,
      };
    }

    let qa: VisualQaResult;
    try {
      qa = await deps.visualQa.evaluate({
        imagePngBase64: finalPng.toString("base64"),
        archetype: plan.archetype,
        platformFormatKey: plan.platformFormat.key,
        widthPx: plan.platformFormat.widthPx,
        heightPx: plan.platformFormat.heightPx,
      });
    } catch (error) {
      // Vision API failure degrades gracefully to the deterministic-only
      // signal — generation is never lost to a QA outage, and the outcome
      // is honestly labelled as not visually verified.
      record.visualQaError = error instanceof Error ? error.message : "Visual QA call failed";
      log.warn({ err: error }, "Visual QA Brain unavailable — falling back to deterministic-only acceptance");
      return {
        status: "PASS_DETERMINISTIC_ONLY",
        finalSvg,
        finalPng,
        finalScore: null,
        iterations,
      };
    }

    record.visualQa = qa;
    lastScore = qa.overallScore;

    // The threshold decision is code, not the model's verdict field —
    // and a non-empty catastrophic-defect list blocks PASS regardless of
    // how high the numeric score is (a score must never hide a clipped,
    // overlapping, or fabricated-branding output).
    const passThreshold = deps.passThreshold ?? VISUAL_QA_PASS_THRESHOLD;
    if (qa.overallScore >= passThreshold && qa.catastrophicDefects.length === 0) {
      return { status: "PASS", finalSvg, finalPng, finalScore: qa.overallScore, iterations };
    }

    if (i === MAX_ACCEPTANCE_ITERATIONS) break;

    // Bounded corrections (presentation only — facts are never touched).
    const corrections = qa.requiredCorrections;
    const tuning: CompositionTuning = { ...plan.tuning };
    if (corrections.some((c) => c.type === "INCREASE_HEADLINE_EMPHASIS")) {
      tuning.headlineScale = (tuning.headlineScale ?? 1) + 0.12;
    }
    if (corrections.some((c) => c.type === "IMPROVE_SPACING")) {
      tuning.spacingScale = (tuning.spacingScale ?? 1) + 0.15;
    }
    plan = { ...plan, tuning };

    const wantsImageRegen = corrections.some((c) => c.type === "REGENERATE_IMAGE");
    if (wantsImageRegen && archetypeUsesGeneratedImagery(plan.archetype) && deps.regenerateImage) {
      const defectNotes = corrections.filter((c) => c.type === "REGENERATE_IMAGE").map((c) => c.note);
      const regenerated = await deps.regenerateImage(defectNotes);
      if (regenerated) {
        plan = { ...plan, backgroundImageDataUri: regenerated };
        record.regeneratedImage = true;
      }
    }
  }

  return {
    status: "BLOCKED_VISUAL_QA",
    finalSvg,
    finalPng,
    finalScore: lastScore,
    iterations,
    blockReason: `Visual QA stayed below ${deps.passThreshold ?? VISUAL_QA_PASS_THRESHOLD}/100 after ${MAX_ACCEPTANCE_ITERATIONS} iterations (last score: ${lastScore ?? "n/a"}). Defects: ${iterations
      .flatMap((r) => r.visualQa?.defects ?? [])
      .join("; ")}`,
  };

  function blockDeterministic(gate: GateResult, reason: string): AcceptanceOutcome {
    return {
      status: "BLOCKED_DETERMINISTIC",
      finalSvg,
      finalPng,
      finalScore: null,
      iterations,
      blockReason: `${reason}: ${gate.failures.join("; ")}`,
    };
  }
}
