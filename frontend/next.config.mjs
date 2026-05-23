/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
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
        hostname: 'localhost',
        pathname: '/public/banners/**',
        protocol: 'http',
        port: '3000',
      },
      {
        protocol: 'https',
        hostname: 'imba.bet',
        pathname: '/public/banners/**',
      }
    ],
    domains: ['upload.wikimedia.org', 'flagcdn.com', 'localhost'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Оптимизации для ускорения навигации
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@tanstack/react-query'],
  },
  // Оптимизация компиляции
  swcMinify: true,
  // Оптимизация изображений
  images: {
    ...nextConfig.images,
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  // Оптимизация кэширования
  async headers() {
    return [
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
