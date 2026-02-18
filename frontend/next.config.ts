import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config to silence the error and use default behavior
  turbopack: {},
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
