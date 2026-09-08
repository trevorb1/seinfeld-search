import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/api/**/*": [path.join(__dirname, "data", "seinfeld.db")],
  },
};

export default nextConfig;
