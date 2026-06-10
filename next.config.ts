import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Edge runtime is not used — board routes need long-lived streaming
    // and the Node.js runtime gives more headroom on Fluid Compute.
  },
};

export default nextConfig;
