import { defineConfig } from '@tarojs/cli'
import path from 'node:path'

export default defineConfig({
  projectName: 'dinqorai-miniprogram',
  date: '2026-07-22',
  designWidth: 390,
  deviceRatio: { 390: 2 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  copy: { patterns: [{ from: 'src/theme.json', to: 'dist/theme.json' }, { from: 'src/native', to: 'dist/native' }], options: {} },
  framework: 'react',
  compiler: 'webpack5',
  alias: { '@': path.resolve(process.cwd(), 'src') },
  mini: {
    postcss: { pxtransform: { enable: true }, cssModules: { enable: false } },
    webpackChain(chain) {
      // Keep cross-chunk exports stable when WeChat replaces page and common bundles separately.
      chain.optimization.set('mangleExports', false)
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    devServer: {
      host: '127.0.0.1',
      port: 10086,
      proxy: {
        '/api': {
          target: 'https://api.xiaodongding.dpdns.org',
          changeOrigin: true,
        },
      },
    },
  },
})
