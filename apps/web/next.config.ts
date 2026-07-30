import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@hindcast/db", "@prisma/client"],
  // Hide the Next.js dev overlay badge in the bottom-left corner.
  devIndicators: false,
};

export default nextConfig;
