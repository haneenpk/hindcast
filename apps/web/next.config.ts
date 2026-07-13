import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@hindcast/db", "@prisma/client"],
};

export default nextConfig;
