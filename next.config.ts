import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "stripe"],
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.trycloudflare.com"],
};

export default nextConfig;
