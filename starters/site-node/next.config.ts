import type { NextConfig } from 'next'
import path from 'node:path'

// Один код сайта, два режима поставки (ADR-005):
//   ssr    — Node-процесс: страницы собираются заранее и обновляются по сигналу ядра;
//   static — папка out/ для хостинга без Node (уровень L1, только FTP/SFTP).
const mode = process.env.SITE_MODE === 'static' ? 'static' : 'ssr'

const nextConfig: NextConfig = {
  output: mode === 'static' ? 'export' : undefined,
  // В Next 16 экспорт пишется прямо в distDir.
  distDir: mode === 'static' ? 'out' : '.next',
  trailingSlash: mode === 'static',
  // Файлы *.ssr.ts нужны только серверному режиму (приём сигнала ядра).
  pageExtensions: mode === 'static' ? ['tsx', 'ts'] : ['tsx', 'ts', 'ssr.ts'],
  images: { unoptimized: true },
  transpilePackages: ['@renote/site-sdk', '@renote/module-sdk'],
  turbopack: { root: path.resolve(import.meta.dirname, '../..') },
  env: { SITE_MODE: mode },
}

export default nextConfig
