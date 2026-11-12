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
  actions: new Map<string, (event?: any) => any>(),
  password: vi.fn(),
  wechat: vi.fn(),
  wx: vi.fn(),
  setUser: vi.fn(),
  continuation: null as null | (() => void),
  navigate: vi.fn(),
  relaunch: vi.fn(),
  toast: vi.fn(),
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
    getEnv: () => 'WEAPP',
    ENV_TYPE: { WEAPP: 'WEAPP' },
    login: state.wx,
    navigateBack: state.navigate,
    reLaunch: state.relaunch,
    showToast: state.toast,
  },
  useLoad: (cb: any) => {
    state.load = cb
  },
  useUnload: (cb: any) => {
    state.unload = cb
  },
}))
vi.mock('@tarojs/components', () => ({
  Text: 'span',
  View: (props: any) => {
    if (props.onClick) state.actions.set(props.className || 'view', props.onClick)
    return createElement('div', null, props.children)
  },
  Button: (props: any) => {
    state.actions.set(props.children, props.onClick)
    return createElement('button', { disabled: props.disabled }, props.children)
  },
  Input: (props: any) => {
    state.actions.set(props.placeholder, props.onInput)
    return createElement('input', { placeholder: props.placeholder })
  },
}))
vi.mock('@/components/ThemeView', () => ({ ThemeView: 'main' }))
vi.mock('@/components/NavBar', () => ({ NavBar: () => null }))
vi.mock('@/i18n', () => ({ t: (key: string) => key, useLocale: () => 'zh' }))
vi.mock('@/api/auth', () => ({ authApi: { login: state.password, wechatLogin: state.wechat } }))
vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) => selector({ setUser: state.setUser }),
}))
vi.mock('@/utils/loginPrompt', () => ({
  takeLoginContinuation: () => {
    const next = state.continuation
    state.continuation = null
    return next
  },
}))
import Login from './index'
const render = () => {
  state.cursor = 0
  state.refCursor = 0
  state.actions.clear()
  return renderComponent(createElement(Login))
}
const passwordForm = () => {
  render()
  state.actions.get('login.emailLogin')!()
  state.actions.get('login-legal-toggle ')!()
  render()
  state.actions.get('login.accountPlaceholder')!({ detail: { value: 'alice' } })
  state.actions.get('login.passwordPlaceholder')!({ detail: { value: 'secret' } })
  render()
}
beforeEach(() => {
  state.values = []
  state.refs = []
  state.continuation = null
  vi.clearAllMocks()
  state.password.mockReset().mockResolvedValue({ userInfo: { username: 'alice' } })
  state.navigate.mockReset().mockResolvedValue(undefined)
  state.wx.mockReset().mockResolvedValue({ code: 'code' })
  state.wechat.mockReset().mockResolvedValue({ pendingBind: true, pendingBindToken: 'pending' })
})
it('keeps username password login available for existing accounts', async () => {
  passwordForm()
  await state.actions.get('login.emailLogin')!()
  expect(state.password).toHaveBeenCalledWith('alice', 'secret')
  expect(state.setUser).toHaveBeenCalledWith({ username: 'alice' })
})
it('does not navigate or authorize when an in-flight existing login completes after Back', async () => {
  let resolve!: (response: any) => void
  state.password.mockReturnValue(
    new Promise(done => {
      resolve = done
    }),
  )
  const continuation = vi.fn()
  state.continuation = continuation
  passwordForm()
  const pending = state.actions.get('login.emailLogin')!()
  state.unload()
  resolve({ userInfo: { username: 'alice' } })
  await pending
  expect(state.setUser).toHaveBeenCalledWith({ username: 'alice' })
  expect(state.navigate).not.toHaveBeenCalled()
  expect(state.relaunch).not.toHaveBeenCalled()
  expect(continuation).not.toHaveBeenCalled()
  expect(state.toast).not.toHaveBeenCalled()
})
it('completes the saved QR continuation after a successful existing login', async () => {
  const continuation = vi.fn()
  state.continuation = continuation
  passwordForm()
  await state.actions.get('login.emailLogin')!()
  await Promise.resolve()
  expect(state.navigate).toHaveBeenCalledTimes(1)
  expect(continuation).toHaveBeenCalledTimes(1)
  expect(state.relaunch).not.toHaveBeenCalled()
})
it('offers existing-account linking without a skip-and-create action', async () => {
  render()
  state.load({ existing: '1' })
  let html = render()
  expect(html).toContain('login.qrLinkWechat')
  state.actions.get('login-legal-toggle ')!()
  render()
  await state.actions.get('login.qrLinkWechat')!()
  html = render()
  expect(html).toContain('login.bindAndLogin')
  expect(html).not.toContain('login.skipBind')
})
it('blocks repeated password submission before the React loading update', async () => {
  state.password.mockReturnValue(new Promise(() => {}))
  passwordForm()
  state.actions.get('login.emailLogin')!()
  state.actions.get('login.emailLogin')!()
  expect(state.password).toHaveBeenCalledTimes(1)
})
