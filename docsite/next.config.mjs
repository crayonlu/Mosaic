import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  ...(process.env.STATIC_EXPORT === 'true' && {
    output: 'export',
    images: {
      unoptimized: true,
    },
    basePath: '/Mosaic',
  }),
  turbopack: {
    root: process.cwd(),
  },
};

export default withMDX(config);
