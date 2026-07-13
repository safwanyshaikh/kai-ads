import { describe, expect, it } from "vitest";
import { normalizeInterviewEvents, toInterviewJson } from "@/server/generation/interview-events";

describe("interview-events — Decision 3 (structured multi-city interview support)", () => {
  it("preserves two distinct interview events for the real Bilfinger source (Baroda + Mumbai)", () => {
    const stored = toInterviewJson([
      { date: "14th & 15th July", location: "Baroda" },
      { date: "18th July", location: "Mumbai" },
    ]);
    const events = normalizeInterviewEvents(stored);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ date: "14th & 15th July", location: "Baroda" });
    expect(events[1]).toEqual({ date: "18th July", location: "Mumbai" });
  });

  it("reads the legacy single {date, location} shape (every advertisement generated before Decision 3) without a migration", () => {
    const legacyRecord = { date: "1 Aug 2026", location: "Mumbai" };
    const events = normalizeInterviewEvents(legacyRecord);
    expect(events).toEqual([{ date: "1 Aug 2026", location: "Mumbai" }]);
  });

  it("returns an empty array for a null/absent interview column", () => {
    expect(normalizeInterviewEvents(null)).toEqual([]);
    expect(normalizeInterviewEvents(undefined)).toEqual([]);
    expect(normalizeInterviewEvents({})).toEqual([]);
  });

  it("drops empty events (no date and no location) when writing", () => {
    const stored = toInterviewJson([
      { date: "14th & 15th July", location: "Baroda" },
      {},
    ]);
    expect(stored.events).toHaveLength(1);
  });

  it("filters out empty events when reading a structured record with a stray empty entry", () => {
    const events = normalizeInterviewEvents({ events: [{ date: "1 Aug 2026", location: "Mumbai" }, { date: "", location: "" }] });
    expect(events).toHaveLength(1);
  });
});
