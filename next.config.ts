import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 用 lightningcss 代替 cssnano 压缩 CSS：
    // 体积更小、且对现代 CSS 语法（color-mix / @media range）的兼容性更好。
    useLightningcss: true,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
