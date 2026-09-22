/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fail the production build on type or lint errors instead of shipping them.
  // Vercel deploys this as its own project (Root Directory = admin).
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
