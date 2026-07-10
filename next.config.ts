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
  ],
  experimental: {
    // Tree-shakes named imports from these packages instead of pulling
    // in the whole module graph for a handful of exports.
    optimizePackageImports: ["zod", "react-hook-form"],
  },
};

export default nextConfig;
