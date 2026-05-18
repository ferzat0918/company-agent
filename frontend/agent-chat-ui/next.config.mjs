/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  // `output: export` produces a static bundle for the nginx container in prod.
  // In dev we skip it — static export disables rewrites, which we need below
  // to dodge CORS (Kong/LangGraph aren't reachable same-origin under `next dev`).
  ...(isDev ? {} : { output: "export" }),
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Dev-only: proxy /auth, /rest, /storage to Kong (8000) and /agent to
  // LangGraph (2024) so the browser only ever talks to :3000 (same origin).
  // Inert in prod because the production build is a static export.
  async rewrites() {
    if (!isDev) return [];
    const kong = process.env.DEV_KONG_URL ?? "http://localhost:8000";
    const langgraph = process.env.DEV_LANGGRAPH_URL ?? "http://localhost:2024";
    return [
      { source: "/auth/v1/:path*", destination: `${kong}/auth/v1/:path*` },
      { source: "/rest/v1/:path*", destination: `${kong}/rest/v1/:path*` },
      { source: "/storage/v1/:path*", destination: `${kong}/storage/v1/:path*` },
      { source: "/agent/v1/:path*", destination: `${langgraph}/:path*` },
    ];
  },
};

export default nextConfig;
