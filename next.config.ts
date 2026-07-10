import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    // Linting runs as its own CI/`npm run lint` step; don't block `next build` on it.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
