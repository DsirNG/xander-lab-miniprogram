import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ci from 'miniprogram-ci'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const keyPath = process.argv[2] || process.env.WX_PRIVATE_KEY_PATH

try {
  if (!keyPath || !fs.statSync(keyPath).isFile()) {
    throw new Error('Pass a private key file path or set WX_PRIVATE_KEY_PATH.')
  }
  const outputDir = path.join(root, '.temp', 'preview')
  fs.mkdirSync(outputDir, { recursive: true })
  const qrcodePath = path.join(outputDir, 'qrcode.jpg')
  // Remove an older code so a failed preview cannot be mistaken for success.
  fs.rmSync(qrcodePath, { force: true })
  const project = new ci.Project({
    appid: config.appid,
    type: 'miniProgram',
    projectPath: path.resolve(root, config.miniprogramRoot || '.'),
    privateKeyPath: path.resolve(keyPath),
    ignores: ['node_modules/**/*', 'README.md'],
  })
  await ci.preview({
    project,
    desc: 'DinQorAI phone preview',
    setting: { es6: true, minified: true, uploadWithSourceMap: false, urlCheck: false },
    qrcodeFormat: 'image',
    qrcodeOutputDest: qrcodePath,
  })
  console.log(`Scan with WeChat: ${qrcodePath}`)
} catch (error) {
  console.error('Preview failed:', error.message)
  process.exitCode = 1
}
