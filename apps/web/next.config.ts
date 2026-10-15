import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mentor-bti/bti-core", "@mentor-bti/bti-content", "@mentor-bti/bti-scoring", "@mentor-bti/ui-tokens"]
};

export default nextConfig;

