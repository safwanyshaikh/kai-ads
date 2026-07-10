import { describe, expect, it } from "vitest";
import {
  createAdvertisementSchema,
  positionSchema,
  advertisementSearchQuerySchema,
} from "@/lib/validations/advertisement";

const validInput = {
  header: "Welders Needed — Gulf",
  industry: "Construction",
  country: "UAE",
  positions: [{ title: "Welder", count: 10 }],
};

describe("createAdvertisementSchema", () => {
  it("accepts a minimal valid advertisement", () => {
    const result = createAdvertisementSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("defaults benefits/interview/contact to empty structures", () => {
    const result = createAdvertisementSchema.parse(validInput);
    expect(result.benefits).toEqual([]);
    expect(result.interview).toEqual({});
    expect(result.contact).toEqual({});
    expect(result.style).toBe("VISUAL");
  });

  it("rejects a missing header", () => {
    const result = createAdvertisementSchema.safeParse({ ...validInput, header: "" });
    expect(result.success).toBe(false);
  });

  it("rejects zero positions", () => {
    const result = createAdvertisementSchema.safeParse({ ...validInput, positions: [] });
    expect(result.success).toBe(false);
  });

  it("employer is optional per the Advertisement Schema", () => {
    const result = createAdvertisementSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts an explicit employer", () => {
    const result = createAdvertisementSchema.safeParse({ ...validInput, employer: "Acme Construction LLC" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid style", () => {
    const result = createAdvertisementSchema.safeParse({ ...validInput, style: "CINEMATIC" });
    expect(result.success).toBe(false);
  });
});

describe("positionSchema", () => {
  it("requires a title", () => {
    const result = positionSchema.safeParse({ count: 5 });
    expect(result.success).toBe(false);
  });

  it("coerces a string count to a number", () => {
    const result = positionSchema.parse({ title: "Electrician", count: "3" });
    expect(result.count).toBe(3);
  });
});

describe("advertisementSearchQuerySchema", () => {
  it("defaults includeArchived to true and includeDeleted to false", () => {
    const result = advertisementSearchQuerySchema.parse({});
    expect(result.includeArchived).toBe(true);
    expect(result.includeDeleted).toBe(false);
  });

  it("coerces string booleans from query params", () => {
    const result = advertisementSearchQuerySchema.parse({ includeDeleted: "true" });
    expect(result.includeDeleted).toBe(true);
  });
});
