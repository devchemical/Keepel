/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Empty turbopack config to silence the Turbopack warning
  turbopack: {},
}

export default nextConfig
