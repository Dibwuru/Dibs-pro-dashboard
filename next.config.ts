import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://auth.privy.io https://*.privy.io chrome-extension://*; frame-src 'self' https://auth.privy.io https://*.privy.io chrome-extension://*;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
