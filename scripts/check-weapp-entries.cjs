const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '../dist')
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const pages = [
  ...config.pages,
  ...(config.subPackages ?? config.subpackages ?? []).flatMap(({ root, pages }) =>
    pages.map(page => root + '/' + page),
  ),
]

async function verify() {
for (const page of pages) {
  // Theme backgrounds use a regular view and the native background API. Keep
  // transferred PageMeta nodes out of the startup render path.
  const markup = fs.readFileSync(path.join(root, page + '.wxml'), 'utf8')
  if (/<page-meta\b/.test(markup)) {
    throw new Error('Unexpected transferred PageMeta node: ' + page)
  }
  const registered = []
  const loaded = new Set()
  let current
  let app
  let instance
  const updates = []
  const renderErrors = []
  const context = vm.createContext({
    console: { log() {}, warn() {}, error: (...args) => renderErrors.push(args.join(' ')) },
    wx: {
      getStorageSync: () => '',
      getSystemInfoSync: () => ({ windowWidth: 375 }),
      getAppBaseInfo: () => ({}),
      getWindowInfo: () => ({ windowWidth: 375, windowHeight: 812, statusBarHeight: 44, safeArea: { bottom: 790 } }),
      getMenuButtonBoundingClientRect: () => ({ left: 280, top: 48, height: 32 }),
      getDeviceInfo: () => ({ platform: 'ios' }),
      onThemeChange() {}, offThemeChange() {},
      onWindowResize() {}, offWindowResize() {},
      onKeyboardHeightChange() {}, offKeyboardHeightChange() {},
      setBackgroundColor: options => options.success?.({}),
      setNavigationBarColor: options => options.success?.({}),
      setBackgroundTextStyle: options => options.success?.({}),
    },
    App(config) { app = config },
    Page(config) { registered.push(config) },
    Component() {},
    getApp: () => app,
    getCurrentPages: () => instance ? [instance] : [],
    setTimeout, clearTimeout, setInterval, clearInterval,
    require: name => execute(path.resolve(path.dirname(current), name)),
  })

  function execute(file) {
    if (!file.endsWith('.js')) file += '.js'
    if (loaded.has(file)) return
    loaded.add(file)
    const previous = current
    current = file
    try {
      vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file })
    } finally {
      current = previous
    }
  }

  try {
    execute(path.join(root, 'app.js'))
    execute(path.join(root, page))
    if (registered.length !== 1) throw new Error('Page did not register')
    if (page === config.pages[0]) {
      app.onLaunch({ path: page, query: {}, scene: 1001 })
      instance = Object.assign({
        route: page,
        setData(data, callback) { updates.push(data); callback?.() },
      }, registered[0])
      instance.onLoad({})
      await new Promise(resolve => setTimeout(resolve, 100))
      instance.onShow()
      await new Promise(resolve => setTimeout(resolve, 100))
      if (renderErrors.length) throw new Error(renderErrors.join('\n'))
      const payload = JSON.stringify(updates)
      if (!payload.includes('main-shell') || !payload.includes('theme-page-backdrop')) {
        throw new Error('Startup did not render the main shell and theme background')
      }
      instance.onUnload()
    }
  } catch (error) {
    throw new Error('WeChat entry failed: ' + page + ': ' + error.message, { cause: error })
  }
}

console.log('Verified ' + pages.length + ' WeChat entry points with a clean module cache.')
console.log('Verified compiled app launch, main page load/show, and initial rendered data.')
}
verify().catch(error => { console.error(error); process.exitCode = 1 })
