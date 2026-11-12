const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { randomUUID } = require('node:crypto')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const candidates = [
  process.env.WECHAT_WCC,
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'],
    'Tencent/微信web开发者工具/code/package.nw/node_modules/wcc-exec/wcc.exe'),
].filter(Boolean)
const compiler = candidates.find(file => fs.existsSync(file))
if (!compiler) {
  console.log('WXS compiler unavailable. Set WECHAT_WCC to enable the WeChat compiler check.')
  process.exit(0)
}

for (const directory of ['src/native/chat-drawer', 'dist/native/chat-drawer']) {
  const output = path.join(os.tmpdir(), 'dinqor-wxs-' + randomUUID() + '.js')
  try {
    const result = spawnSync(compiler, ['-o', output,
      './' + directory + '/index.wxml', './' + directory + '/gesture.wxs'],
      { cwd: root, encoding: 'utf8', windowsHide: true })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'WXS compilation failed')
  } finally {
    if (fs.existsSync(output)) fs.unlinkSync(output)
  }
}
console.log('WeChat WXML/WXS compiler passed for source and built drawer components.')
