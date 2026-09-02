import { defineConfig } from '@tarojs/cli'
import path from 'node:path'

export default defineConfig({
  projectName: 'dinqorai-miniprogram',
  date: '2026-07-22',
  designWidth: 390,
  deviceRatio: { 390: 2 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  alias: { '@': path.resolve(__dirname, '..', 'src') },
  mini: { postcss: { pxtransform: { enable: true }, cssModules: { enable: false } } },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    devServer: {
      host: '127.0.0.1',
      port: 10086,
      proxy: {
        '/api': {
          target: 'https://api.dinqor.cn',
          changeOrigin: true,
        },
      },
    },
  },
})
