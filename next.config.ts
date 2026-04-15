import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/mine",
        destination: "/mine/favorites/review",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
