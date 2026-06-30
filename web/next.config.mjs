/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Stellar SDK is large and pulls in optional deps; keep the build lean.
  webpack: (config) => {
    config.externals = config.externals || [];
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
  eslint: {
    // Lint is run explicitly in CI (`pnpm lint`); don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
