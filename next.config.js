const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  transpilePackages: [
    'jspdf',
    'pdf-lib',
    'mammoth',
    'tesseract.js',
    'qrcode',
    'jszip',
    'xlsx',
    'pdfjs-dist'
  ],

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    unoptimized: true,
  },

  // Matikan Turbopack, gunakan Webpack
  turbopack: false,

  webpack: (config, { isServer }) => {
    // Handle 'canvas' module untuk pdfjs-dist
    config.resolve.alias = {
      ...config.resolve.alias,
      'canvas': false,
    };

    // Fallback untuk module Node.js yang tidak tersedia di browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      buffer: false,
      util: false,
      os: false,
      http: false,
      https: false,
      zlib: false,
      net: false,
      tls: false,
      child_process: false,
      worker_threads: false,
    };

    // Ignore peringatan tertentu
    config.ignoreWarnings = [
      { module: /node_modules\/pdfjs-dist/ },
      { message: /Can't resolve 'canvas'/ },
    ];

    return config;
  },

  output: 'standalone',
};

module.exports = nextConfig;