import type { NextConfig } from 'next';
import path from 'node:path';
const nextConfig: NextConfig = {
  output: 'standalone',
  distDir: process.env.TEST_WEB_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.TEST_WEB_DIST_DIR ? 'tsconfig.e2e.json' : 'tsconfig.json' },
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
};
export default nextConfig;
