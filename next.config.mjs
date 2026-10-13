/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    // optimize package imports to reduce bundle size dramatically
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  // Ensure xlsx works smoothly across server & client
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
