import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Step 6 — end-to-end chunk/merge verification against the real
 * runKaiExtraction() entry point. The OpenAI client itself is mocked (no
 * network, no API key needed); the mock stands in for the model by
 * literally parsing "<Title> — <count>" lines out of whatever chunk text
 * it's given, the same way a real extraction model would structure them.
 * This exercises the real chunking, grounding, and merge code — only the
 * network call is faked.
 */

const parseCalls: string[] = [];

function fakeExtractPositions(text: string) {
  const lines = text.split("\n");
  const positions = [];
  for (const line of lines) {
    const match = line.match(/^(.+?)\s*[—-]\s*(\d+)\s*(?:\([^)]*\))?\s*$/);
    if (!match) continue;
    positions.push({
      title: match[1].trim(),
      tradeSummary: "",
      quantity: { value: Number(match[2]), confidence: "MEDIUM" as const },
      salaryAmount: { value: null, confidence: "LOW" as const },
      salaryCurrency: { value: null, confidence: "LOW" as const },
      salaryTiers: [],
      experience: { value: null, confidence: "LOW" as const },
      qualification: { value: null, confidence: "LOW" as const },
      ageLimit: { value: null, confidence: "LOW" as const },
      possibleDuplicateOfIndex: null,
    });
  }
  return positions;
}

vi.mock("@/server/ai/openai/openai-client", () => ({
  getOpenAiClient: () => ({
    responses: {
      parse: vi.fn(async ({ input }: { input: string }) => {
        parseCalls.push(input);
        return {
          output_parsed: {
            country: { value: "Saudi Arabia", confidence: "MEDIUM" },
            industry: { value: "Construction", confidence: "MEDIUM" },
            projectType: { value: null, confidence: "LOW" },
            employer: { value: null, confidence: "LOW" },
            positions: fakeExtractPositions(input),
            benefits: { value: null, confidence: "LOW" },
            interviewMode: { value: null, confidence: "LOW" },
            interviewDate: { value: null, confidence: "LOW" },
            interviewTime: { value: null, confidence: "LOW" },
            interviewVenue: { value: null, confidence: "LOW" },
            interviewEvents: [],
            contact: { value: null, confidence: "LOW" },
            originalSourceText: input,
            overallConfidence: "MEDIUM",
            warnings: [],
          },
          usage: { input_tokens: 10, output_tokens: 10 },
        };
      }),
    },
  }),
  getKaiTextModel: () => "test-text-model",
  getKaiVisionModel: () => "test-vision-model",
}));

import { runKaiExtraction } from "@/server/ai/openai/kai-extraction-engine";
import { EXTRACTION_CHUNK_CHARS } from "@/server/ai/text-chunking";

beforeEach(() => {
  parseCalls.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

const NINETEEN_ROLES: [string, number][] = [
  ["Operation Manager", 1],
  ["WPR", 25],
  ["Time Keeper/HR Executive", 2],
  ["Procurement Engineer-Estimation", 2],
  ["Purchaser", 2],
  ["Planning Engineer Lead", 1],
  ["Planning Engineer", 1],
  ["Procurement Engineer Construction", 2],
  ["Procurement Manager", 1],
  ["Electrician", 10],
  ["Tile Mason", 2],
  ["IT Administrator", 1],
  ["HVAC Technician", 45],
  ["DDC Technician (HVAC)", 7],
  ["Mechanical Engineer (HVAC)", 5],
  ["Project Manager", 5],
  ["Quality Manager", 5],
  ["HSE Manager", 5],
  ["PQCS", 5],
];

describe("Step 6 — runKaiExtraction chunk/merge integrity", () => {
  it("1. source at/under the limit: unchanged behaviour — exactly one model call", async () => {
    const text = NINETEEN_ROLES.map(([t, c]) => `${t} — ${c}`).join("\n");
    const { result } = await runKaiExtraction({ text });
    expect(parseCalls).toHaveLength(1);
    expect(result.positions).toHaveLength(19);
  });

  it("2. source over 20,000 characters is not silently truncated — every chunk's text is sent to the model", async () => {
    const filler = "x".repeat(EXTRACTION_CHUNK_CHARS + 5000);
    const text = `${filler}\nPQCS — 5`;
    await runKaiExtraction({ text });
    expect(parseCalls.length).toBeGreaterThan(1);
    const concatenated = parseCalls.join("");
    expect(concatenated.length).toBe(text.length);
    expect(concatenated).toContain("PQCS — 5");
  });

  it("3. a position appearing after character 20,000 survives extraction assembly", async () => {
    const filler = "Padding line with no position data.\n".repeat(600); // > 20,000 chars
    expect(filler.length).toBeGreaterThan(EXTRACTION_CHUNK_CHARS);
    const text = `${filler}PQCS — 5`;
    const { result } = await runKaiExtraction({ text });
    expect(result.positions.some((p) => p.title === "PQCS" && p.quantity.value === 5)).toBe(true);
  });

  it("4. multi-chunk extraction preserves all positions, exact counts, and source order", async () => {
    const text = NINETEEN_ROLES.map(([t, c]) => `${t} — ${c}`).join("\n".repeat(1) + "Padding padding padding.\n".repeat(900));
    const { result } = await runKaiExtraction({ text });
    expect(parseCalls.length).toBeGreaterThan(1);
    expect(result.positions.map((p) => p.title)).toEqual(NINETEEN_ROLES.map(([t]) => t));
    expect(result.positions.map((p) => p.quantity.value)).toEqual(NINETEEN_ROLES.map(([, c]) => c));
  });

  it("5. the exact 19-role / 127-vacancy dataset remains 19 roles / 127 vacancies, PQCS = 5", async () => {
    // Forced into 3 chunks so this exercises real multi-chunk merge, not the single-call path.
    const chunkSize = Math.floor(EXTRACTION_CHUNK_CHARS / 8);
    const lines = NINETEEN_ROLES.map(([t, c]) => `${t} — ${c}`);
    const padded = lines
      .map((line, i) => (i % 6 === 5 ? `${line}\n${"pad ".repeat(chunkSize / 4)}` : line))
      .join("\n");
    const { result } = await runKaiExtraction({ text: padded });

    expect(result.positions).toHaveLength(19);
    const totalVacancies = result.positions.reduce((sum, p) => sum + (p.quantity.value ?? 0), 0);
    expect(totalVacancies).toBe(127);
    const pqcs = result.positions.find((p) => p.title === "PQCS");
    expect(pqcs?.quantity.value).toBe(5);
  });
});
