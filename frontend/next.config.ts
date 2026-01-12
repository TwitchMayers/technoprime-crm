import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api/richmarket/:path*',
        destination: 'http://127.0.0.1:4000/richmarket/:path*',
      },
      {
        source: '/api/technoprime/:path*', 
        destination: 'http://127.0.0.1:4000/:path*',
      },
    ];
  },
};

export default nextConfig;