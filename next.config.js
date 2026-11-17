/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/reels.html',
      },
      {
        source: '/reels',
        destination: '/reels.html',
      },
    ];
  },
};

module.exports = nextConfig;
