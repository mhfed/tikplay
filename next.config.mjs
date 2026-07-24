import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingExcludes: {
    '/': ['./.venv/**/*', './cache/**/*', './data/**/*'],
    '/*': ['./.venv/**/*', './cache/**/*', './data/**/*'],
    '/api/*': ['./.venv/**/*', './cache/**/*', './data/**/*'],
  },
  // TypeScript 7's native compiler isn't yet compatible with Next's
  // build-time typecheck integration (crashes; typescript-eslint has the
  // same gap). Type safety is enforced separately via `npx tsc --noEmit`,
  // which works fine against TS7.
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname,
    };
    return config;
  },
};

export default nextConfig;
