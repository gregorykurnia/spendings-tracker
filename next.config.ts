import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Test builds go to their own folder (.next-test) so they never mix with
  // the normal build or dev server output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
