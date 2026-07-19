import { describe, expect, it } from "vitest";
import {
  generateGptBackgroundBrief,
  type CreativeBrainVisualDecisions,
} from "@/server/generation/background-brief";

/**
 * The Bilfinger reference — the Creative Brain's VISUAL decisions only.
 * Note there is deliberately no phone, email, interview, positions, salary,
 * employer branding, QR or CTA anywhere: those belong to the overlay engine
 * and the input type cannot carry them.
 */
const BILFINGER: CreativeBrainVisualDecisions = {
  primaryHook: "SAUDI ARABIA · OIL & GAS SHUTDOWN",
  emotionalDirection: ["MONEY", "PRESTIGE", "URGENCY"],
  colourMood: "DESERT_GOLD",
  visualStory: "WORKER_HERO",
  visualWeight: "The Gulf oil & gas opportunity and the hero worker — not the employer brand",
  attentionPath: [
    "Hero worker in the right third",
    "Refinery towers receding into warm haze",
    "Open golden sky",
  ],
  industry: "Oil & Gas",
  destination: "Saudi Arabia",
  projectType: "Shutdown / maintenance turnaround",
  compositionPriority: "HERO_RIGHT_DATA_LEFT",
  aspectRatio: 1,
};

describe("generateGptBackgroundBrief — GPT Background Brief Generator", () => {
  it("produces all seven authored sections", () => {
    const brief = generateGptBackgroundBrief(BILFINGER);
    expect(brief.sections.scene).toBeTruthy();
    expect(brief.sections.hero).toBeTruthy();
    expect(brief.sections.environment).toBeTruthy();
    expect(brief.sections.lighting).toBeTruthy();
    expect(brief.sections.colourGrading).toBeTruthy();
    expect(brief.sections.composition).toBeTruthy();
    expect(brief.sections.negativePrompt).toBeTruthy();
  });

  it("is deterministic — identical input yields identical output", () => {
    const a = generateGptBackgroundBrief(BILFINGER);
    const b = generateGptBackgroundBrief(BILFINGER);
    expect(a.prompt).toEqual(b.prompt);
  });

  it("encodes the Bilfinger creative intent (refinery, golden hour, desert gold, hero-right)", () => {
    const { prompt } = generateGptBackgroundBrief(BILFINGER);
    expect(prompt).toMatch(/refinery/i);
    expect(prompt).toMatch(/golden-hour/i);
    expect(prompt).toMatch(/desert gold/i);
    expect(prompt).toMatch(/RIGHT HERO ZONE/);
    expect(prompt).toMatch(/Saudi Arabia/);
    expect(prompt).toMatch(/Oil & Gas/);
  });

  it("commits to a warm palette and explicitly bans a cool cast (the V12 weakness)", () => {
    const { prompt } = generateGptBackgroundBrief(BILFINGER);
    expect(prompt).toMatch(/no cool green or blue cast/i);
  });

  it("carries the full negative prompt (Truth Brain + image hygiene)", () => {
    const { prompt } = generateGptBackgroundBrief(BILFINGER);
    for (const banned of ["NO text", "NO logos", "NO QR", "NO signage", "NO watermark", "NO fabricated information"]) {
      expect(prompt).toContain(banned);
    }
  });

  it("never leaks factual overlay copy into the image prompt", () => {
    const { prompt } = generateGptBackgroundBrief(BILFINGER);
    // None of these appear in the input type, and none must appear in output.
    expect(prompt).not.toMatch(/\+?\d[\d\s-]{7,}/); // phone-like digit runs
    expect(prompt).not.toMatch(/@/); // email
    expect(prompt).not.toMatch(/bilfinger/i); // employer branding
    expect(prompt).not.toMatch(/welder|technician/i); // position titles
  });

  it("keeps intent signals in traceability, not in the rendered prompt", () => {
    const brief = generateGptBackgroundBrief(BILFINGER);
    expect(brief.traceability.primaryHook).toBe("SAUDI ARABIA · OIL & GAS SHUTDOWN");
    expect(brief.traceability.resolvedLighting).toBe("GOLDEN_HOUR");
    // The hook string itself must NOT be echoed into the image prompt as caption text.
    expect(brief.prompt).not.toContain("SAUDI ARABIA · OIL & GAS SHUTDOWN");
  });

  it("throws when no emotional direction is supplied", () => {
    expect(() =>
      generateGptBackgroundBrief({ ...BILFINGER, emotionalDirection: [] }),
    ).toThrow(/emotionalDirection/);
  });

  it("does not mistake the word \"refined\" in a hospitality industry description for an oil & gas signal", () => {
    const { prompt } = generateGptBackgroundBrief({
      ...BILFINGER,
      visualStory: "TEAM",
      industry: "a luxury hospitality interior, refined and premium",
    });
    expect(prompt).not.toMatch(/oil & gas refinery/i);
  });
});
