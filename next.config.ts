import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const runtimeCaching = [
  {
    urlPattern: ({ request, url }: { request: Request; url: URL }) =>
      request.mode === "navigate" && url.origin === self.location.origin,
    handler: "NetworkFirst",
    options: {
      cacheName: "next-docs-pages",
      networkTimeoutSeconds: 5,
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 24 * 60 * 60,
      },
      cacheableResponse: {
        statuses: [200],
      },
    },
  },
  {
    urlPattern: ({ request, url }: { request: Request; url: URL }) =>
      request.method === "GET" &&
      url.origin === self.location.origin &&
      url.pathname.startsWith("/api/documents"),
    handler: "NetworkFirst",
    options: {
      cacheName: "next-docs-api",
      networkTimeoutSeconds: 5,
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 24 * 60 * 60,
      },
      cacheableResponse: {
        statuses: [200],
      },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "google-fonts-webfonts",
      expiration: {
        maxEntries: 8,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "google-fonts-stylesheets",
      expiration: {
        maxEntries: 8,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico|json)$/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "next-docs-assets",
      expiration: {
        maxEntries: 96,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
    },
  },
];

const withPWA = withPWAInit({
  dest: "public",
  sw: "sw.js",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/_offline",
  },
  runtimeCaching,
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
