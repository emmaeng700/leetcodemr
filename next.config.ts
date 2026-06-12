import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
