import type { NextConfig } from "next";
import path from "path";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";

if (process.env.VERCEL === "1" && !process.env.API_PROXY_TARGET) {
  throw new Error(
    "API_PROXY_TARGET is required on Vercel (e.g. https://your-api.vercel.app). Set it in the frontend project env and redeploy."
  );
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiTarget}/api/:path*` },
      { source: "/uploads/:path*", destination: `${apiTarget}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
