import type { NextConfig } from "next";
import path from "path";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";

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
