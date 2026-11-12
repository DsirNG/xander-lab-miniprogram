const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { randomUUID } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..', 'dist')
const compiler = [process.env.WECHAT_WCSC, process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Tencent/微信web开发者工具/code/package.nw/node_modules/wcc-exec/wcsc.exe')].filter(Boolean).find(file => fs.existsSync(file))
if (!compiler) { console.log('WXSS compiler unavailable. Set WECHAT_WCSC to enable native stylesheet validation.'); process.exit(0) }
const files = fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('.wxss')).map(file => './' + file.replaceAll('\\', '/'))
const output = path.join(os.tmpdir(), 'dinqor-wxss-' + randomUUID() + '.js')
try {
  const result = spawnSync(compiler, ['-o', output, ...files], { cwd: root, encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'WXSS compilation failed')
  console.log(`WeChat WXSS compiler passed for ${files.length} stylesheets.`)
} finally { if (fs.existsSync(output)) fs.unlinkSync(output) }
