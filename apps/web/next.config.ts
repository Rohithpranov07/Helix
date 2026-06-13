import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@helix/shared", "@helix/db", "@helix/ai", "@helix/engine"],
};

export default nextConfig;
