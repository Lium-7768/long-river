/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three / drei 的 ESM 包走 transpile
  transpilePackages: ['three'],
};
export default nextConfig;
