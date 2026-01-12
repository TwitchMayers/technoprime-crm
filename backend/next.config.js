/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/richmarket/:path*',
        destination: 'http://127.0.0.1:4000/richmarket/:path*',
      },
    ];
  },
}

module.exports = nextConfig