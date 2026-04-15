import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "dev").slice(0, 7),
  },
};

export default nextConfig;
