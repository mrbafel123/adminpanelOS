import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import { readFileSync } from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
const pkg = JSON.parse(readFileSync(path.join(dirname, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
}

const nextConfig: NextConfig = {
  // Пакеты монорепозитория (SDK и модули) поставляются исходниками TypeScript.
  transpilePackages: Object.keys(pkg.dependencies).filter((name) => name.startsWith('@renote/')),
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  // Корень — монорепозиторий: pnpm хранит пакеты в корневом node_modules.
  turbopack: {
    root: path.resolve(dirname, '..'),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
