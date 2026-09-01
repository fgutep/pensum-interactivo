/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  eslint: {
    // lint is run separately in CI; don't fail the container build on it
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
