import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // youtubei.js (InnerTube client for transcript ingestion) ships dynamic
  // requires that confuse the bundler — load it from node_modules at runtime.
  serverExternalPackages: ["youtubei.js"],
};

export default nextConfig;
