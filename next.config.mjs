/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // TypeScript 7's native compiler isn't yet compatible with Next's
  // build-time typecheck integration (crashes; typescript-eslint has the
  // same gap). Type safety is enforced separately via `npx tsc --noEmit`,
  // which works fine against TS7.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
