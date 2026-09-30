import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser on 127.0.0.1 is treated as cross-origin vs localhost binding;
  // allow HMR / font assets in local development.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
