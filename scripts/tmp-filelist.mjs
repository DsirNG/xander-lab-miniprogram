import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCompiledResult, Project } from 'miniprogram-ci'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const APPID = 'wx63b2e6732ff75cc8'

const project = new Project({
  appid: APPID,
  type: 'miniProgram',
  projectPath: path.join(rootDir, 'dist'),
  privateKeyPath: path.join(rootDir, 'keys', `private.${APPID}.key`),
  ignores: ['node_modules/**/*', 'README.md'],
})

const files = await getCompiledResult({
  project,
  setting: { es6: false, minified: true, urlCheck: false },
})
const names = Object.keys(files).sort()
console.log('TOTAL:', names.length)
console.log(names.join('\n'))
