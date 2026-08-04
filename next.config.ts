import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfkit"],
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./storage/**/*", "./backups/**/*", "./next.config.ts"],
  },
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
};

export default nextConfig;
