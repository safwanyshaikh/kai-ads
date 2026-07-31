/**
 * KAI Advertisement Composer — CLI entry point.
 *
 * Input:  a Creative Background PNG (artwork only) + the raw recruiter
 *         message. Output: final-advertisement.png.
 *
 * Usage:
 *   GEMINI_TEXT_API_KEY=... npx tsx scripts/experiments/kai-advertisement-composer/run.ts \
 *     --background <bg.png> --message <message.txt> --out <dir> [--logo <logo.png>] [--qr-url <url>]
 */
import { readFile, writeFile } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import { extractFacts } from "./facts";
import { compose, buildVerifiedQr } from "./composer";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const backgroundPath = arg("background");
  const messagePath = arg("message");
  const outDir = arg("out") ?? ".";
  const logoPath = arg("logo");
  const qrUrl = arg("qr-url");

  if (!backgroundPath) throw new Error("--background <creative background png> is required.");
  if (!messagePath) throw new Error("--message <raw recruiter message txt> is required.");

  const apiKey = process.env.GEMINI_TEXT_API_KEY;
  if (!apiKey) throw new Error("GEMINI_TEXT_API_KEY is required (parsing only — never rewriting).");
  const model = process.env.KAI_TEXT_MODEL ?? "gemini-3.5-flash-lite";

  const backgroundPng = await readFile(backgroundPath);
  const rawMessage = await readFile(messagePath, "utf8");
  // Real logo only. No asset supplied means no logo is drawn — the
  // Composer never fabricates a mark.
  const logoPng = logoPath ? await readFile(logoPath) : null;

  const client = new GoogleGenAI({ apiKey });

  console.log("Parsing recruiter message (extraction only)...");
  const { facts, ungrounded } = await extractFacts(client, model, rawMessage);
  await writeFile(`${outDir}/extracted-facts.json`, JSON.stringify(facts, null, 2));
  console.log(`  positions: ${facts.positions.length}`);
  if (ungrounded.length) {
    console.log(`  REFUSED ${ungrounded.length} ungrounded value(s) — not rendered:`);
    for (const u of ungrounded) console.log(`    - ${u}`);
  } else {
    console.log("  all extracted values traced to the source message");
  }

  const qr = qrUrl ? await buildVerifiedQr(qrUrl) : null;
  if (qr) console.log(`  QR decodable: ${qr.decodable} -> ${qr.url}`);
  if (qr && !qr.decodable) throw new Error("Generated QR failed its own decode check — refusing to ship it.");

  console.log("Composing (deterministic factual rendering)...");
  const png = await compose({ backgroundPng, facts, logoPng, qr });
  const outPath = `${outDir}/final-advertisement.png`;
  await writeFile(outPath, png);
  const meta = await import("sharp").then((m) => m.default(png).metadata());
  console.log(`final-advertisement.png -> ${outPath}  (${meta.width}x${meta.height})`);
}

main().catch((error: unknown) => {
  console.error("FAILED:", (error as Error).message);
  process.exit(1);
});
