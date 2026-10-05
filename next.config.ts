import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./storage/**/*", "./backups/**/*", "./next.config.ts"],
  },
  // ponytail: bound build workers so deployment fits the shared production server.
  experimental: { cpus: 2, serverActions: { bodySizeLimit: "25mb" } },
};

export default nextConfig;
