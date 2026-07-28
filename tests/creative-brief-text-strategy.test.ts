import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Under the Factual Integrity Law (docs/010 Amendment 1) the Creative Brief
 * briefs background artwork only. It must never ask the image model to print
 * a fact — that class of instruction produced every text defect this project
 * measured: dropped roles, invented roles, broken numbering, garbled strings.
 */
describe("Creative Brief — artwork only", () => {
  const source = readFileSync("src/server/generation/pipeline/creative-brief.ts", "utf8");

  it("briefs the background artwork, not the advertisement", () => {
    expect(source).toMatch(/BACKGROUND ARTWORK ONLY/);
  });

  it("instructs the image model to render no text at all", () => {
    expect(source).toMatch(/NO text, NO letters, NO numbers/);
  });

  it("never asks the model to print a position, salary, or contact detail", () => {
    expect(source).not.toMatch(/print EXACTLY/i);
    expect(source).not.toMatch(/positions available/i);
    expect(source).not.toMatch(/TEXT TO RENDER/);
  });

  it("does not leak printable facts into the model input", () => {
    // Only industry/country/project/trade names go to the artwork brief —
    // never salaries, contacts, licence numbers or interview details.
    const inputBlock = source.slice(source.indexOf("input: JSON.stringify("));
    expect(inputBlock).not.toMatch(/salary|contact|registration|licence|interview/i);
  });

  it("forbids advertising copy, which is what garbled in live runs", () => {
    expect(source).toMatch(/Do not write advertising copy/i);
  });
});
