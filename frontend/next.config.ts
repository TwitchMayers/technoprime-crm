import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async rewrites() {
    return [
      {
        source: '/assets/:path*',
        destination: 'http://127.0.0.1:4000/assets/:path*',
      },
    ];
  },
};

export default nextConfig;
