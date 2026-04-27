const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  customWorkerSrc: "worker",
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-api",
          expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 },
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /\/api\/contacts.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "contacts-cache",
          expiration: { maxEntries: 64, maxAgeSeconds: 5 * 60 },
        },
      },
      {
        urlPattern: /\/api\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 },
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "images",
          expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\.(?:js|css|woff|woff2|ttf|otf)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-resources",
          expiration: { maxEntries: 128, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 25mb: celulares modernos tiram fotos de 5-10MB cada. Com 2 fotos de
    // check-in mais alguma margem, 25mb cobre. Acima disso e DoS.
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

module.exports = withPWA(nextConfig);
