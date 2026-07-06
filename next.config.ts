import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent folder has another package-lock.json; pin Turbopack to this app.
  turbopack: {
    root: path.join(process.cwd()),
  },
  // Avoid stale module graph after refactors (orderStrategies import, etc.).
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  allowedDevOrigins: ['192.168.1.173'],
  env: {
    NEXT_PUBLIC_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "dev").slice(0, 7),
  },
  async redirects() {
    return [
      { source: "/mock", destination: "/mcp?tab=mock", permanent: false },
      { source: "/patterns", destination: "/mcp?tab=patterns", permanent: false },
      { source: "/clipboard", destination: "/mcp?tab=clipboard", permanent: false },
    ];
  },
};

export default nextConfig;
