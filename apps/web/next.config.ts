import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this independent migration workspace rather than the
  // legacy repository root, which has its own lockfile and prototype application.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
