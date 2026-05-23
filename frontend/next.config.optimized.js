/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'cdn.incub.space',
      'upload.wikimedia.org',
      'flagcdn.com'
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
  
  // Автоматически определяем режим разработки
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development'
  },
  
  // Оптимизации для разработки
  webpack: (config, { dev, isServer }) => {
    // Отключаем некоторые проверки в режиме разработки
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.next']
      };
      
      // Ускоряем сборку в разработке
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
    }

    // SVG loader
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

    // Source maps только для продакшена
    if (!dev) {
      config.module.rules.push({
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
        exclude: /node_modules/,
      });
    }

    return config;
  },
};

module.exports = nextConfig; 