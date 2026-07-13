import { describe, expect, it } from "vitest";
import { detectCompensationSignal } from "@/server/generation/compensation-signal.service";

describe("detectCompensationSignal — Decision 2 (real salary/compensation signal)", () => {
  it("is true for the real Bilfinger Shutdown Project benefit text", () => {
    expect(detectCompensationSignal([{ label: "Basic salary + daily overtime up to 4 hours" }])).toBe(true);
  });

  it("is false when no compensation-related benefit is present", () => {
    expect(detectCompensationSignal([{ label: "Free accommodation" }, { label: "Annual flight ticket" }])).toBe(
      false,
    );
  });

  it("is false for an empty benefits list", () => {
    expect(detectCompensationSignal([])).toBe(false);
  });

  it("detects compensation keywords in the detail field, not just the label", () => {
    expect(detectCompensationSignal([{ label: "Extra pay", detail: "Monthly allowance included" }])).toBe(true);
  });

  it("detects the 'OT' abbreviation as a whole word, not as a substring of an unrelated word", () => {
    expect(detectCompensationSignal([{ label: "OT paid separately" }])).toBe(true);
    expect(detectCompensationSignal([{ label: "A lot of overtime opportunities" }])).toBe(true); // "overtime" itself is a phrase match
    expect(detectCompensationSignal([{ label: "Accommodation provided" }])).toBe(false);
  });

  it("never infers compensation from unrelated fields — only benefits text is checked", () => {
    // A caller must not pass job title/country/employer into this function —
    // this test documents that the function's only input is benefits text.
    expect(detectCompensationSignal([{ label: "Senior Petroleum Engineer, UAE, Bilfinger" }])).toBe(false);
  });
});
