/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'imba.bet',
        pathname: '/uploads/**',
      },
    ],
  },
  // Backend API calls use NEXT_PUBLIC_API_URL directly.
  // Do NOT rewrite /api/* here — it breaks NextAuth at /api/auth/*
};

module.exports = nextConfig;

