import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ci from 'miniprogram-ci'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const APPID = process.env.WX_APPID || 'wx63b2e6732ff75cc8'
const PRIVATE_KEY_PATH =
  process.env.WX_PRIVATE_KEY_PATH || path.join(rootDir, 'keys', `private.${APPID}.key`)
const VERSION = process.env.WX_VERSION || process.argv[2] || '1.0.0'
const DESC = process.env.WX_DESC || process.argv[3] || 'DinQorAI 小程序体验版'
const ROBOT = Number(process.env.WX_ROBOT || 1)
const PROJECT_PATH = process.env.WX_PROJECT_PATH || path.join(rootDir, 'dist')

const project = new ci.Project({
  appid: APPID,
  type: 'miniProgram',
  projectPath: PROJECT_PATH,
  privateKeyPath: PRIVATE_KEY_PATH,
  ignores: ['node_modules/**/*', 'README.md'],
})

console.log(`uploading ${APPID} v${VERSION} (robot ${ROBOT}) from ${PROJECT_PATH} ...`)

ci.upload({
  project,
  version: VERSION,
  desc: DESC,
  setting: {
    es6: true,
    minified: true,
    uploadWithSourceMap: false,
    urlCheck: false,
  },
  robot: ROBOT,
  onProgressUpdate: info => {
    if (info.status === 'uploading') {
      console.log(`progress: ${info.current}/${info.total} ${info.name}`)
    }
  },
})
  .then(() => {
    console.log('upload success. open WeChat DevTools to set the trial/experience version.')
  })
  .catch(err => {
    console.error('upload failed:', err)
    process.exit(1)
  })
