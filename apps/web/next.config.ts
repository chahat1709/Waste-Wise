import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this independent migration workspace rather than the
  // legacy repository root, which has its own lockfile and prototype application.
  turbopack: {
    root: process.cwd(),
  },
  // Arena exposes dev servers through a generated *.e2b.app preview hostname.
  // This affects development-only HMR resources and is not a production CORS rule.
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;
