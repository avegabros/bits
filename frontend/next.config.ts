import type { NextConfig } from "next";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from project root .env
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

// BACKEND_URL:
//   LOCAL  → set in root-level .env  (e.g. http://localhost:3001)
//   DOCKER → set in docker-compose.yml (e.g. http://backend:3001)
const backendUrl = process.env.BACKEND_URL;
if (!backendUrl) {
  throw new Error(
    "[next.config] BACKEND_URL is not set.\n" +
    "  LOCAL:  Add BACKEND_URL=http://localhost:3001 to root-level .env\n" +
    "  DOCKER: It is already set in docker-compose.yml"
  );
}

const nextConfig: NextConfig = {
  turbopack: {
    // Force Turbopack to use the frontend folder as the project root.
    // Otherwise it climbs up to the .git folder in the parent directory
    // and fails to resolve tailwindcss.
    root: process.cwd(),
  },
  webpack: (config) => {
    config.watchOptions = {
      ignored: ['**/node_modules/**', '**/.next/**'],
      poll: 1000,
      aggregateTimeout: 300,
    }
    return config
  },
  async rewrites() {
    return [
      {
        // Forward all /api/* requests to the backend,
        // EXCEPT routes handled by Next.js server-side route handlers.
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
        missing: [
          {
            type: 'header',
            key: 'x-nextjs-route-handler',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
