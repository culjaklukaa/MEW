import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "mew.com",
  ],
};

export default nextConfig;