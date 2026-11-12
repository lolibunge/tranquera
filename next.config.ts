import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mapas SVG de hasta 2 MB y logos.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
