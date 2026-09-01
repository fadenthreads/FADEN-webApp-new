import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@faden/auth",
    "@faden/ui",
    "@faden/env",
    "@faden/supabase",
  ],
};

export default nextConfig;
