import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@helix/shared", "@helix/db", "@helix/ai", "@helix/engine"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  serverExternalPackages: ["mongoose"],
  webpack(config) {
    // NodeNext TS source uses `.js` extensions; webpack needs to resolve them to `.ts`
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
