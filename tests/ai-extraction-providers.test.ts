import { describe, expect, it } from "vitest";
import { getAiExtractionToolkit } from "@/server/ai";
import { AiProviderNotImplementedError } from "@/server/ai/types";

/**
 * Sprint 002 ships AI Extraction architecture only — no GPT/OpenAI/Claude
 * implementation. These tests verify the architecture itself: every one
 * of the seven required interfaces is wired into the toolkit and, when
 * invoked, fails loudly and specifically (never silently returns a fake
 * "found" result) — exactly the contract advertisement-draft.service.ts
 * depends on to fall back to manual entry.
 */
describe("AI Extraction provider architecture", () => {
  const toolkit = getAiExtractionToolkit();
  const input = { text: "Need 10 welders for a UAE site." };

  it("provides all seven required provider interfaces", () => {
    expect(toolkit.requirementExtraction).toBeDefined();
    expect(toolkit.tradeSummary).toBeDefined();
    expect(toolkit.industryDetection).toBeDefined();
    expect(toolkit.countryDetection).toBeDefined();
    expect(toolkit.employerDetection).toBeDefined();
    expect(toolkit.salaryDetection).toBeDefined();
    expect(toolkit.interviewDetection).toBeDefined();
  });

  it("RequirementExtractionProvider throws AiProviderNotImplementedError, not a fake result", async () => {
    await expect(toolkit.requirementExtraction.extractRequirements(input)).rejects.toThrow(
      AiProviderNotImplementedError,
    );
  });

  it("TradeSummaryProvider throws AiProviderNotImplementedError", async () => {
    await expect(toolkit.tradeSummary.summarizeTrade(input)).rejects.toThrow(
      AiProviderNotImplementedError,
    );
  });

  it("IndustryDetectionProvider throws AiProviderNotImplementedError", async () => {
    await expect(toolkit.industryDetection.detectIndustry(input)).rejects.toThrow(
      AiProviderNotImplementedError,
    );
  });

  it("CountryDetectionProvider throws AiProviderNotImplementedError", async () => {
    await expect(toolkit.countryDetection.detectCountry(input)).rejects.toThrow(
      AiProviderNotImplementedError,
    );
  });

  it("EmployerDetectionProvider throws AiProviderNotImplementedError", async () => {
    await expect(toolkit.employerDetection.detectEmployer(input)).rejects.toThrow(
      AiProviderNotImplementedError,
    );
  });

  it("SalaryDetectionProvider throws AiProviderNotImplementedError", async () => {
    await expect(toolkit.salaryDetection.detectSalary(input)).rejects.toThrow(
      AiProviderNotImplementedError,
    );
  });

  it("InterviewDetectionProvider throws AiProviderNotImplementedError", async () => {
    await expect(toolkit.interviewDetection.detectInterview(input)).rejects.toThrow(
      AiProviderNotImplementedError,
    );
  });

  it("the error message names the specific provider, not a generic failure", async () => {
    await expect(toolkit.industryDetection.detectIndustry(input)).rejects.toThrow(
      /IndustryDetectionProvider/,
    );
  });

  it("returns the same cached toolkit instance across calls (single seam for a future real provider)", () => {
    const second = getAiExtractionToolkit();
    expect(second).toBe(toolkit);
  });
});
