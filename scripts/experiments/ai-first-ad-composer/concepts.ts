/**
 * Prompt Engineering Experiment — 30 creative directions.
 *
 * Same isolation rules as generate.ts: no renderer, no layout engine, no
 * deterministic positioning, no QR, no footer, no factual validation, no
 * production code imported. The model receives the same raw recruiter
 * text every time and one of 30 distinct creative-direction prompts; it
 * decides everything about the image.
 *
 * Usage:
 *   GEMINI_IMAGE_API_KEY=... npx tsx scripts/experiments/ai-first-ad-composer/concepts.ts <outDir>
 */
import { writeFile } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

const RAW_INPUT = `Plant Maintenance Saudi Arabia
Instrument Technician
Electrical Technician
Mechanical Technician
Rotating Equipment Technician
Analyzer Technician
Bolt Technician
Torch Technician

Minimum 5 years Oil & Gas Maintenance.
Diploma / Degree preferred.
Exceptional candidates may be considered.
Send CV to jobs@alyousufent.com
WhatsApp +91 8655960415`;

interface Concept {
  n: number;
  name: string;
  direction: string;
}

const CONCEPTS: Concept[] = [
  { n: 1, name: "Corporate Premium", direction: "Polished corporate recruitment creative: navy and white, confident serif or geometric sans headline, restrained gold accent, boardroom-grade credibility." },
  { n: 2, name: "Industrial Cinematic", direction: "Cinematic industrial photography style: dramatic side lighting, steel and steam, wide establishing shot of a plant, moody colour grade, film-still composition." },
  { n: 3, name: "Saudi Mega Project", direction: "Evokes the scale of a Saudi giga-project: vast desert industrial landscape, monumental infrastructure, sense of national ambition and scale." },
  { n: 4, name: "Oil & Gas Shutdown", direction: "Shutdown/turnaround maintenance context: technicians mid-task on live plant equipment, urgent but professional, hi-vis and hard hats, technical realism." },
  { n: 5, name: "Luxury Recruitment", direction: "Treat this like a luxury brand campaign: deep charcoal and metallic gold, elegant thin typography, generous negative space, aspirational tone." },
  { n: 6, name: "LinkedIn Executive", direction: "LinkedIn-native executive-hiring aesthetic: clean corporate blue, professional headshot-style human presence, trustworthy and formal, feed-optimised." },
  { n: 7, name: "Facebook Viral", direction: "Designed to stop the scroll on Facebook: bold saturated colour blocking, oversized friendly typography, high energy, shareable meme-adjacent format." },
  { n: 8, name: "WhatsApp Shareable", direction: "Optimised for WhatsApp forwarding: square format, extremely legible at thumbnail size, bold headline, minimal fine detail, instantly readable on a small screen." },
  { n: 9, name: "Magazine Cover", direction: "Treat as a glossy trade-magazine cover: large masthead-style headline, editorial photography, cover-line style secondary text, premium print aesthetic." },
  { n: 10, name: "Billboard Style", direction: "Outdoor billboard design principles: extremely bold, huge type, minimal words, readable from a distance, one dominant visual, no clutter." },
  { n: 11, name: "Newspaper Premium", direction: "Elevated newspaper classified convention: ruled columns, serif headline, ink-on-paper texture, dignified black and white with one spot colour." },
  { n: 12, name: "Engineering Blueprint", direction: "Technical blueprint aesthetic: cyanotype blue background, white line-drawing diagrams of plant equipment, drafting-table precision, engineering-schematic feel." },
  { n: 13, name: "Minimal Swiss", direction: "Swiss/International Typographic Style: strict grid, Helvetica-like sans, red or black accent only, huge whitespace, ruthless minimalism." },
  { n: 14, name: "Black & Gold", direction: "Black and gold luxury palette exclusively, high contrast, metallic foil-style accents, premium and exclusive in tone." },
  { n: 15, name: "Aramco Inspired", direction: "Inspired by major national oil company corporate identity: deep green and white, monumental industrial photography, institutional gravitas." },
  { n: 16, name: "Petrochemical Plant", direction: "Petrochemical facility as hero: distillation towers, pipe racks, flare stacks at dusk, industrial teal and amber lighting." },
  { n: 17, name: "Construction Mega Project", direction: "Construction mega-project energy: cranes, structural steel, workers against a rising skyline, sense of building something enormous." },
  { n: 18, name: "Human Focus", direction: "The worker is the hero, not the plant: close-up portrait-style photography of a technician, dignity and skill emphasised, warm human lighting." },
  { n: 19, name: "Equipment Focus", direction: "The equipment is the hero: macro/detail photography of technical instrumentation and tools, precision and craftsmanship emphasised, no people." },
  { n: 20, name: "Night Shift Plant", direction: "Night shift atmosphere: floodlit plant against a dark sky, sodium and blue lighting contrast, sense of round-the-clock operation." },
  { n: 21, name: "Orange Industrial", direction: "Safety-orange as the dominant colour, industrial hazard-stripe motifs used decoratively, high-visibility energy throughout." },
  { n: 22, name: "Blue Corporate", direction: "Cool corporate blue palette throughout, trustworthy and clean, subtle gradient backgrounds, conservative and safe." },
  { n: 23, name: "Modern Infographic", direction: "Infographic-driven layout: icons representing each role and requirement, data-visualisation-style information design, clean modern icon set." },
  { n: 24, name: "Hiring Campaign", direction: "Full ad-campaign energy: 'WE ARE HIRING' as a dominant graphic statement, campaign-poster confidence, bold call to action." },
  { n: 25, name: "Safety First", direction: "Safety-culture-led design: PPE prominently and positively featured, safety iconography, reassuring and disciplined tone." },
  { n: 26, name: "GCC Recruitment", direction: "General GCC/Gulf recruitment-market convention: warm sand and teal palette, Gulf skyline silhouette motif, regionally specific visual cues." },
  { n: 27, name: "High Contrast", direction: "Extreme high-contrast black/white/single-accent design, graphic poster energy, punchy and stark, no midtones." },
  { n: 28, name: "Dark Premium", direction: "Dark-mode premium aesthetic: near-black background, crisp white and single accent typography, glowing highlight accents, tech-premium feel." },
  { n: 29, name: "International Careers", direction: "Global-careers agency tone: passport/travel-adjacent visual motifs, world-map or globe suggestion, sense of international opportunity." },
  { n: 30, name: "Award Winning Creative", direction: "Design this as if entering a top international advertising-award competition: the single most original, art-directed composition you can conceive, unexpected but still commercially legible." },
];

function buildPrompt(concept: Concept): string {
  return [
    "You are designing a complete recruitment advertisement image for social media. You have full creative",
    "freedom over layout, typography, hierarchy, spacing, colour, background, icons and overall visual",
    "composition — decide all of it yourself. Do not use a template or a fixed grid convention.",
    "",
    `CREATIVE DIRECTION — ${concept.name}: ${concept.direction}`,
    "",
    "Render every piece of the following recruiter message as legible, accurate text somewhere in the",
    "advertisement. Do not omit, invent, reorder, or misspell any detail. Group and typeset the information",
    "however fits this creative direction best — you decide the structure entirely:",
    "",
    RAW_INPUT,
    "",
    "The result must be immediately readable on a phone screen.",
  ].join("\n");
}

async function main() {
  const outDir = process.argv[2] ?? ".";
  const apiKey = process.env.GEMINI_IMAGE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_IMAGE_API_KEY is required.");
  const model = process.env.KAI_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image";
  const client = new GoogleGenAI({ apiKey });

  const paths: string[] = [];
  for (const concept of CONCEPTS) {
    const label = String(concept.n).padStart(2, "0");
    const path = `${outDir}/concept-${label}.png`;
    try {
      const response = await client.models.generateContent({
        model,
        contents: buildPrompt(concept),
        config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "3:4" } },
      });
      const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
      if (!imagePart?.inlineData?.data) {
        console.error(`${label} ${concept.name}: FAILED — no image data`);
        continue;
      }
      await writeFile(path, Buffer.from(imagePart.inlineData.data, "base64"));
      paths.push(path);
      console.log(`${label} ${concept.name} -> ${path}`);
    } catch (error) {
      console.error(`${label} ${concept.name}: FAILED — ${(error as Error).message}`);
    }
  }

  await buildGallery(paths, `${outDir}/concept-gallery.png`);
  console.log(`gallery -> ${outDir}/concept-gallery.png (${paths.length}/${CONCEPTS.length} concepts)`);
}

/** 5 columns x 6 rows contact sheet of whatever concepts actually generated. */
async function buildGallery(paths: string[], outPath: string) {
  const cols = 5;
  const rows = 6;
  const cellW = 300;
  const cellH = 400;

  const tiles = await Promise.all(
    paths.map((p) => sharp(p).resize(cellW, cellH, { fit: "cover" }).toBuffer()),
  );

  const canvas = sharp({
    create: { width: cellW * cols, height: cellH * rows, channels: 4, background: "#1a1a1a" },
  });

  const composite = tiles.map((tile, i) => ({
    input: tile,
    left: (i % cols) * cellW,
    top: Math.floor(i / cols) * cellH,
  }));

  await canvas.composite(composite).png().toFile(outPath);
}

main().catch((error: unknown) => {
  console.error("FAILED:", (error as Error).message);
  process.exit(1);
});
