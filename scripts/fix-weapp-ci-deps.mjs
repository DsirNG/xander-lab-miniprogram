import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pnpmDir = path.join(root, 'node_modules', '.pnpm')
const hoistedDir = path.join(pnpmDir, 'node_modules')

const log = (...a) => console.log('[fix-weapp-ci]', ...a)

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function findPkgDir(dirPrefix, pkgRelPath, versionOk) {
  let found = null
  for (const d of fs.readdirSync(pnpmDir)) {
    if (!d.startsWith(dirPrefix)) continue
    const pkgDir = path.join(pnpmDir, d, 'node_modules', ...pkgRelPath.split('/'))
    try {
      const v = readJson(path.join(pkgDir, 'package.json')).version
      if (versionOk(v)) {
        found = pkgDir
        break
      }
    } catch {
      /* ignore */
    }
  }
  return found
}

function fixCompatData() {
  const cdDir = path.join(
    pnpmDir,
    '@babel+compat-data@8.0.0',
    'node_modules',
    '@babel',
    'compat-data',
  )
  if (!fs.existsSync(cdDir)) {
    log('skip compat-data: 8.0.0 digest not found')
    return
  }
  const srcDir = findPkgDir('@babel+compat-data@7', '@babel/compat-data', () => true)
  if (!srcDir) {
    log('skip compat-data: no 7.x source found')
    return
  }
  for (const f of ['corejs2-built-ins.js', 'corejs3-shipped-proposals.js']) {
    const dest = path.join(cdDir, f)
    if (!fs.existsSync(dest)) {
      const src = path.join(srcDir, f)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
        log('patched compat-data:', f)
      }
    }
  }
  fs.mkdirSync(path.join(cdDir, 'data'), { recursive: true })
  for (const f of ['corejs2-built-ins.json', 'corejs3-shipped-proposals.json']) {
    const dest = path.join(cdDir, 'data', f)
    if (fs.existsSync(dest)) continue
    const src = path.join(srcDir, 'data', f)
    if (!fs.existsSync(src)) continue
    fs.copyFileSync(src, dest)
    log('patched compat-data/data:', f)
  }
}

function fixPolyfillCorejs3() {
  const hoisted = path.join(hoistedDir, 'babel-plugin-polyfill-corejs3')
  let cur = null
  try {
    cur = readJson(path.join(hoisted, 'package.json'))
  } catch {
    /* not a dir */
  }
  if (cur && cur.version.startsWith('0.6') && cur.main) {
    log('polyfill-corejs3 ok:', cur.version)
    return
  }
  const target = findPkgDir('babel-plugin-polyfill-corej_', 'babel-plugin-polyfill-corejs3', v =>
    v.startsWith('0.6'),
  )
  if (!target) {
    log('skip polyfill-corejs3: no 0.6.x digest found')
    return
  }
  if (fs.existsSync(hoisted)) {
    fs.rmSync(hoisted, { recursive: true, force: true })
  }
  const rel = path.relative(path.dirname(hoisted), target).replace(/\\/g, '/')
  try {
    fs.symlinkSync(rel, hoisted, 'dir')
  } catch (error) {
    // Windows 未开启开发者模式时目录符号链接会报 EPERM；复制依赖可保持同一解析结果。
    if (error?.code !== 'EPERM') throw error
    fs.cpSync(target, hoisted, { recursive: true })
  }
  log('polyfill-corejs3 ->', readJson(path.join(target, 'package.json')).version)
}

function patchCjsExports(pkgDir) {
  for (const f of ['index.js', 'index.min.js']) {
    const file = path.join(pkgDir, 'dist', 'commonjs', f)
    if (!fs.existsSync(file)) continue
    let content = fs.readFileSync(file, 'utf8')
    if (/module\.exports\s*=\s*[A-Za-z_$]/.test(content)) continue
    const m = content.match(/exports\.LRUCache\s*=\s*([A-Za-z_$][\w$]*);/)
    const name = m ? m[1] : 'LRUCache'
    content =
      content.replace(/\/\/# sourceMappingURL=.*$/g, '') +
      `\nmodule.exports = ${name}; module.exports.LRUCache = ${name}; module.exports.default = ${name};\n`
    fs.writeFileSync(file, content)
    log('patched lru-cache CJS exports:', f, '(var', name + ')')
  }
}

function fixLruCache() {
  const hoisted = path.join(hoistedDir, 'lru-cache')
  let cur = null
  try {
    cur = readJson(path.join(hoisted, 'package.json'))
  } catch {
    /* not a dir */
  }
  if (!cur || cur.version !== '11.5.2') {
    const src = findPkgDir('lru-cache@11.5.2', 'lru-cache', v => v === '11.5.2')
    if (!src) {
      log('skip lru-cache: no 11.5.2 digest found')
      return
    }
    if (fs.existsSync(hoisted)) {
      fs.renameSync(
        hoisted,
        path.join(hoistedDir, `lru-cache.bak-${(cur && cur.version) || 'old'}`),
      )
    }
    fs.cpSync(src, hoisted, { recursive: true })
    log('lru-cache -> 11.5.2')
  }
  patchCjsExports(hoisted)
}

function cleanupRootResidue() {
  const p = path.join(root, 'node_modules', 'lru-cache')
  if (fs.existsSync(p)) {
    const st = fs.lstatSync(p)
    if (!st.isSymbolicLink()) {
      fs.rmSync(p, { recursive: true, force: true })
      log('removed root node_modules/lru-cache residue')
    }
  }
}

try {
  fixCompatData()
  fixPolyfillCorejs3()
  fixLruCache()
  cleanupRootResidue()
  log('done.')
} catch (e) {
  console.error('[fix-weapp-ci] FAILED:', e)
  process.exit(1)
}
