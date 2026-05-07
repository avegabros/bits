import type { NextConfig } from "next";

// BACKEND_URL:
//   LOCAL  → set in frontend/.env.local  (e.g. http://localhost:3001)
//   DOCKER → set in docker-compose.yml   (e.g. http://backend:3001)
const backendUrl = process.env.BACKEND_URL;
if (!backendUrl) {
  throw new Error(
    "[next.config] BACKEND_URL is not set.\n" +
    "  LOCAL:  Add BACKEND_URL=http://localhost:3001 to frontend/.env.local\n" +
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
