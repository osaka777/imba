/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      "@tanstack/react-query",
      "date-fns",
      "swiper",
      "react-toastify",
      "usehooks-ts",
    ],
  },
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        hostname: 'cdn.incub.space',
        pathname: '/**',
        protocol: 'https',
      },
      {
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
        protocol: 'https',
      },
      {
        hostname: 'flagcdn.com',
        pathname: '/**',
        protocol: 'https',
      },
      {
        hostname: 'img.sportradar.com',
        pathname: '/**',
        protocol: 'https',
      },
      {
        hostname: 'logo.sportteaminfo.net',
        pathname: '/**',
        protocol: 'https',
      },
      {
        hostname: 'localhost',
        pathname: '/public/banners/**',
        protocol: 'http',
        port: '3000',
      },
      {
        protocol: 'https',
        hostname: 'imba.bet',
        pathname: '/public/banners/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 3600,
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Оптимизация кэширования
  async redirects() {
    return [
      {
        source: "/wc",
        destination: "/line/soccer",
        permanent: true,
      },
      {
        source: "/wc/game/:slug*",
        destination: "/game/:slug*",
        permanent: true,
      },
      {
        source: "/cybersport/line",
        destination: "/line?sport=esports.cs",
        permanent: true,
      },
      {
        source: "/cybersport/line/esports.cs",
        destination: "/line?sport=esports.cs",
        permanent: true,
      },
      {
        source: "/cybersport/line/esports.dota2",
        destination: "/line?sport=esports.dota2",
        permanent: true,
      },
      {
        source: "/cybersport/line/esports.valorant",
        destination: "/line?sport=esports.valorant",
        permanent: true,
      },
      {
        source: "/cybersport/live",
        has: [{ type: "query", key: "sport", value: "esports.cs" }],
        destination: "/live?sport=esports.cs",
        permanent: true,
      },
      {
        source: "/cybersport/live",
        has: [{ type: "query", key: "sport", value: "esports.dota2" }],
        destination: "/live?sport=esports.dota2",
        permanent: true,
      },
      {
        source: "/cybersport/live",
        has: [{ type: "query", key: "sport", value: "esports.valorant" }],
        destination: "/live?sport=esports.valorant",
        permanent: true,
      },
      {
        source: "/cybersport/live",
        destination: "/live?sport=esports.cs",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=30, stale-while-revalidate=60',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000/api/:path*',
      },
    ];
  },
  webpack(config) {
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg"),
    );
    config.module.rules = [
      ...config.module.rules.filter((rule) => rule !== fileLoaderRule),
      { ...fileLoaderRule, exclude: /\.svg$/i },
      {
        ...fileLoaderRule,
        resourceQuery: {
          ...fileLoaderRule.resourceQuery,
          not: [...fileLoaderRule.resourceQuery.not, /component/],
        },
        test: /\.svg$/i,
      },
      {
        issuer: /\.[jt]sx?$/,
        resourceQuery: /component/,
        test: /\.svg$/i,
        use: "@svgr/webpack",
      },
    ];
    
    // Оптимизация бандла
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    };

    return config;
  },
};

export default nextConfig;
