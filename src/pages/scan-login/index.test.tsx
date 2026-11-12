import { createElement } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderComponent } from '../../test/render'

const state = vi.hoisted(() => ({
  values: [] as any[],
  refs: [] as any[],
  cursor: 0,
  refCursor: 0,
  load: null as any,
  unload: null as any,
  actions: new Map<string, () => any>(),
  loggedIn: false,
  user: null as any,
  status: vi.fn(),
  authorize: vi.fn(),
  openLogin: vi.fn(),
  toast: vi.fn(),
  exit: vi.fn(),
}))
vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return {
    ...react,
    useState: (initial: any) => {
      const index = state.cursor++
      if (!(index in state.values)) state.values[index] = initial
      return [
        state.values[index],
        (value: any) => {
          state.values[index] = typeof value === 'function' ? value(state.values[index]) : value
        },
      ]
    },
    useRef: (initial: any) => {
      const index = state.refCursor++
      if (!(index in state.refs)) state.refs[index] = { current: initial }
      return state.refs[index]
    },
    useEffect: vi.fn(),
  }
})
vi.mock('@tarojs/taro', () => ({
  default: {
    showToast: state.toast,
    getCurrentPages: () => [],
    reLaunch: state.exit,
    navigateTo: vi.fn(),
  },
  useLoad: (callback: any) => {
    state.load = callback
  },
  useUnload: (callback: any) => {
    state.unload = callback
  },
}))
vi.mock('@tarojs/components', () => ({
  Text: 'span',
  View: (props: any) => {
    if (props.onClick) state.actions.set(props.className || 'view', props.onClick)
    return createElement('div', null, props.children)
  },
}))
vi.mock('@/components/ui/Button', () => ({
  Button: (props: any) => {
    state.actions.set(props.children, props.onClick)
    return createElement('button', { disabled: props.disabled }, props.children)
  },
}))
vi.mock('@/components/ThemeView', () => ({ ThemeView: 'main' }))
vi.mock('@/components/NavBar', () => ({ NavBar: () => null }))
vi.mock('@/components/Skeleton', () => ({
  SkeletonBlock: () => createElement('i', null, 'loading'),
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key, useLocale: () => 'zh' }))
vi.mock('@/api/auth', () => ({ authApi: { isLoggedIn: () => state.loggedIn } }))
vi.mock('@/store/user', () => ({
  useUserStore: Object.assign((selector: any) => selector({ user: state.user }), {
    getState: () => ({ refresh: vi.fn(), setUser: vi.fn() }),
  }),
}))
vi.mock('@/store/tabBar', () => ({ useTabBarStore: { getState: () => ({ setActive: vi.fn() }) } }))
vi.mock('@/utils/loginPrompt', () => ({ openLogin: state.openLogin }))
vi.mock('@/features/auth/qrAuthorization', () => ({
  readWaitingQr: state.status,
  authorizeQrLogin: state.authorize,
  isWaitingQr: (session: any) => session.status === 'WAITING' && session.expiresAt > Date.now(),
}))
import ScanLogin from './index'

const ticket = 'a'.repeat(32)
const render = () => {
  state.cursor = 0
  state.refCursor = 0
  state.actions.clear()
  return renderComponent(createElement(ScanLogin))
}
const load = async () => {
  render()
  state.load({ ticket })
  await vi.waitFor(() => expect(state.values[2]).toBe(false))
  return render()
}
beforeEach(() => {
  state.values = []
  state.refs = []
  state.loggedIn = false
  state.user = null
  vi.clearAllMocks()
  state.status.mockReset().mockResolvedValue({
    status: 'WAITING',
    device: { os: 'windows', browser: 'chrome' },
    createdAt: Date.now(),
    expiresAt: Date.now() + 120000,
  })
  state.authorize.mockReset().mockReturnValue(new Promise(() => {}))
  state.openLogin.mockReset().mockResolvedValue(undefined)
})
it('only loads device metadata on scan, without signing in or registering', async () => {
  const html = await load()
  expect(html).toContain('login.qrDeviceWindows · login.qrBrowserChrome')
  expect(html).toContain('login.qrTime')
  expect(html).toContain('login.qrAutoRegister')
  expect(html).toContain('disabled=""')
  expect(state.authorize).not.toHaveBeenCalled()
})
it('requires consent, then allows only one in-flight authorization', async () => {
  await load()
  await state.actions.get('login.qrAgreeAndLogin')!()
  expect(state.authorize).not.toHaveBeenCalled()
  expect(state.toast).toHaveBeenCalled()
  state.actions.get('scan-login-checkbox ')!()
  render()
  state.actions.get('login.qrAgreeAndLogin')!()
  state.actions.get('login.qrAgreeAndLogin')!()
  expect(state.authorize).toHaveBeenCalledTimes(1)
  expect(state.authorize.mock.calls[0][0]).toBe(ticket)
})
it('shows the signed-in account and skips the consent gate for an existing session', async () => {
  state.loggedIn = true
  state.user = { nickname: 'Alice', username: 'alice', email: 'alice@example.com' }
  const html = await load()
  expect(html).toContain('Alice')
  expect(html).not.toContain('login.qrAutoRegister')
  expect(html).not.toContain('login.qrExistingAccount')
  state.actions.get('login.qrConfirm')!()
  expect(state.authorize).toHaveBeenCalledTimes(1)
})
it('takes the existing-account route without quick registration and continues after login', async () => {
  await load()
  await state.actions.get('login.qrExistingAccount')!()
  expect(state.openLogin).toHaveBeenCalledWith(expect.any(Function), '?existing=1')
  expect(state.authorize).not.toHaveBeenCalled()
  state.loggedIn = true
  state.openLogin.mock.calls[0][0]()
  expect(state.authorize).toHaveBeenCalledTimes(1)
})
it('cancelling or unloading invalidates in-flight work before it can authorize', async () => {
  state.loggedIn = true
  await load()
  state.actions.get('login.qrConfirm')!()
  const options = state.authorize.mock.calls[0][1]
  expect(options.active()).toBe(true)
  state.actions.get('login.qrCancel')!()
  expect(options.active()).toBe(false)
  expect(state.exit).toHaveBeenCalled()
  state.unload()
  expect(options.active()).toBe(false)
})
it('renders a persistent error and prevents authorization when metadata fails', async () => {
  state.status.mockRejectedValue(new Error('expired'))
  const html = await load()
  expect(html).toContain('expired')
  expect(html).toContain('login.qrRetry')
  expect(state.authorize).not.toHaveBeenCalled()
})
