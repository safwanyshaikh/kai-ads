import { describe, expect, it } from "vitest";
import { displayTitle } from "@/lib/display-title";

describe("displayTitle — advertisement-safe spelling normalisation", () => {
  it("corrects the two defects Visual QA reported against the real advertisement", () => {
    expect(displayTitle("IT Adminstator")).toBe("IT Administrator");
    expect(displayTitle("Qualality Manager")).toBe("Quality Manager");
  });

  it("corrects other unambiguous non-words seen in recruitment sources", () => {
    expect(displayTitle("Mechnical Enginer")).toBe("Mechanical Engineer");
    expect(displayTitle("HVAC Techncian")).toBe("HVAC Technician");
    expect(displayTitle("Electrican")).toBe("Electrician");
  });

  it("preserves punctuation and structure around a corrected word", () => {
    expect(displayTitle("Adminstator/HR")).toBe("Administrator/HR");
    expect(displayTitle("Enginer - Estimation")).toBe("Engineer - Estimation");
  });

  it("leaves a correctly spelled title completely untouched", () => {
    expect(displayTitle("Procurement Engineer Construction")).toBe("Procurement Engineer Construction");
    expect(displayTitle("DDC Technician (HVAC)")).toBe("DDC Technician (HVAC)");
    expect(displayTitle("PQCS")).toBe("PQCS");
  });

  it("does not touch a real English word, even one that looks like a likely typo", () => {
    // "manger" is a dictionary word; guessing "manager" would silently
    // rewrite a role the agency may genuinely have meant.
    expect(displayTitle("Cattle Manger Attendant")).toBe("Cattle Manger Attendant");
  });

  it("is case-insensitive in matching but always emits the canonical spelling", () => {
    expect(displayTitle("IT ADMINSTATOR")).toBe("IT Administrator");
    expect(displayTitle("it adminstator")).toBe("it Administrator");
  });

  it("never mutates its input", () => {
    const original = "IT Adminstator";
    displayTitle(original);
    expect(original).toBe("IT Adminstator");
  });
});
