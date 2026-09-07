import type { NextConfig } from 'next';
import { getBasePath } from './lib/base-path.mjs';
const basePath = getBasePath();
const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  env: { NEXT_PUBLIC_APP_BASE_PATH: basePath },
};
export default nextConfig;
