declare module "next-pwa" {
  import type { NextConfig } from "next";

  type RuntimeCachingRule = {
    urlPattern: RegExp | ((input: { request: Request; url: URL }) => boolean);
    handler: string;
    method?: string;
    options?: Record<string, unknown>;
  };

  type PWAOptions = {
    dest?: string;
    sw?: string;
    register?: boolean;
    skipWaiting?: boolean;
    clientsClaim?: boolean;
    disable?: boolean;
    fallbacks?: {
      document?: string;
      data?: string;
      image?: string;
      audio?: string;
      video?: string;
      font?: string;
    };
    runtimeCaching?: RuntimeCachingRule[];
  };

  export default function withPWA(
    options?: PWAOptions
  ): (nextConfig: NextConfig) => NextConfig;
}
