/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  allowedDevOrigins: process.env.REPLIT_DEV_DOMAIN
    ? [process.env.REPLIT_DEV_DOMAIN]
    : [],
  serverExternalPackages: ["jssip"],
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push({ "utf-8-validate": "commonjs utf-8-validate", bufferutil: "commonjs bufferutil" });
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Cache-Control", value: process.env.NODE_ENV === "production" ? "public, max-age=0, must-revalidate" : "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
