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
  },
};

export default nextConfig;
