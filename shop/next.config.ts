import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ['@technoprime/ui', '@technoprime/lib'],
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [62, 70, 74, 75, 76, 78],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
};

export default nextConfig;
