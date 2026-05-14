/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    return config;
  },
  images: {
    domains: ['ipfs.io', 'cloudflare-ipfs.com', 'gateway.pinata.cloud'],
  },
}

module.exports = nextConfig
