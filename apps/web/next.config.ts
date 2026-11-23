import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: basePath || undefined,
  reactStrictMode: true,
  // 工作区内的 TS 包直接以源码形式参与编译。
  transpilePackages: ['@shihe/domain', '@shihe/sky-layout', '@shihe/db'],
  serverExternalPackages: ['pg'],
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    optimizePackageImports: ['pixi.js'],
  },
};

export default nextConfig;
