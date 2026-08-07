import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    // Linting runs as its own CI/`npm run lint` step; don't block `next build` on it.
    ignoreDuringBuilds: false,
  },
  // Bundle optimization: these are server-only, Node-native, or otherwise
  // not meant to be bundled by webpack for the client/edge graph. Marking
  // them external means Next.js requires them at runtime instead of
  // inlining them into every route that transitively imports them (see
  // src/lib/auth.ts -> email/storage providers, imported by every
  // protected page via src/lib/session.ts).
  serverExternalPackages: [
    "@prisma/client",
    "pg",
    "pino",
    "nodemailer",
    "@aws-sdk/client-s3",
    "sharp",
    // Production bug (2026-08-07): pdf-parse's PDF text extraction sets up
    // a Node "fake worker" via a runtime-relative path it resolves itself
    // (`workerSrc ||= "./pdf.worker.mjs"`, relative to its OWN module file,
    // not a static import) — webpack has no way to see that as a
    // dependency, so it never copies pdf-parse's sibling pdf.worker.mjs
    // into the chunk it relocates the code into, and every PDF upload in
    // production failed with "Cannot find module
    // '.../chunks/pdf.worker.mjs'". Marking it external stops webpack from
    // relocating the code at all, so the relative path resolves against
    // pdf-parse's own package directory (where its worker file already
    // ships) exactly like it does locally.
    "pdf-parse",
  ],
  experimental: {
    // Tree-shakes named imports from these packages instead of pulling
    // in the whole module graph for a handful of exports.
    optimizePackageImports: ["zod", "react-hook-form"],
  },
  // FIX-009: the advertisement renderer reads these .ttf files with
  // fs.readFileSync at request time (see server/generation/embedded-fonts.ts)
  // so the SVG it produces never depends on a system font being installed
  // on the serverless host. Next's file tracer can miss a dynamically
  // constructed fs path, so the font files are listed explicitly here to
  // guarantee they're included in the deployed function bundle.
  // Sprint 006 Bug 005: fonts.conf ships alongside the .ttf files —
  // librsvg only discovers fonts through fontconfig (FONTCONFIG_FILE is
  // set in src/server/generation/font-config.ts), so the whole fonts
  // directory must reach the deployed function bundle.
  outputFileTracingIncludes: {
    "/api/advertisements/[id]/generate": ["./src/server/generation/fonts/*"],
    "/api/advertisements/[id]/export": ["./src/server/generation/fonts/*"],
    "/api/advertisements/[id]/section": ["./src/server/generation/fonts/*"],
    // Production bug (2026-08-07): marking pdf-parse external (above) stops
    // webpack from mangling its module code, but Next's file tracer still
    // only copies files it sees statically imported/required. pdf-parse's
    // OWN pdf.worker.mjs is loaded via a runtime-computed relative path;
    // pdf-parse's ESM build then also statically imports pdfjs-dist's
    // "legacy" build directly, which does the exact same runtime-relative
    // worker lookup a second time, against pdfjs-dist's OWN separate
    // pdf.worker.mjs — verified by tracing the real failure one level
    // deeper than the first fix reached. Both must be included.
    "/api/advertisement-drafts/[id]/extract": [
      "./node_modules/pdf-parse/dist/pdf-parse/**/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/**/pdf.worker.mjs",
    ],
    "/api/internal/fat/run": [
      "./node_modules/pdf-parse/dist/pdf-parse/**/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/**/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
