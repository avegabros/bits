import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // produce a standalone server build so the Dockerfile can copy /.next/standalone
  output: "standalone",
};

export default nextConfig;
