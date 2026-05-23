/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.incub.space',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/public/banners/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/public/banners/**',
      },
      {
        protocol: 'https',
        hostname: 'imba.bet',
        pathname: '/public/banners/**',
      },
      {
        protocol: 'https',
        hostname: 'imba.bet',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'imba.bet',
        pathname: '/banners/**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false, // Отключаем для ускорения разработки
  productionBrowserSourceMaps: false, // Отключаем для ускорения
  experimental: {
    optimizeCss: false, // Отключаем оптимизацию CSS в разработке
  },
  webpack(config) {
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg")
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

    config.module.rules.push({
      test: /\.js$/,
      enforce: 'pre',
      use: ['source-map-loader'],
      exclude: /node_modules/,
    });

    return config;
  },
};

module.exports = nextConfig;
