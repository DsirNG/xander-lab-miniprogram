import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  loggedIn: false,
  login: vi.fn(),
  wechat: vi.fn(),
  skip: vi.fn(),
  confirm: vi.fn(),
}))
vi.mock('@tarojs/taro', () => ({ default: { login: mocks.login } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/api/auth', () => ({
  authApi: {
    qrStatus: mocks.status,
    isLoggedIn: () => mocks.loggedIn,
    wechatLogin: mocks.wechat,
    skipBind: mocks.skip,
    confirmQrLogin: mocks.confirm,
  },
}))
import { authorizeQrLogin, isWaitingQr, readWaitingQr } from './qrAuthorization'

const ticket = 'a'.repeat(32)
const user = { username: 'existing', email: null } as any
const waiting = () => ({ status: 'WAITING', expiresAt: Date.now() + 120000 })
let active = true
const onUser = vi.fn()
const authorize = () =>
  authorizeQrLogin(ticket, { active: () => active, onUser, allowWechatLogin: true })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.loggedIn = false
  active = true
  mocks.status.mockReset().mockImplementation(async () => waiting())
  mocks.login.mockReset().mockResolvedValue({ code: 'wx-code' })
  mocks.wechat.mockReset().mockImplementation(async () => {
    mocks.loggedIn = true
    return { userInfo: user }
  })
  mocks.skip.mockReset().mockImplementation(async () => {
    mocks.loggedIn = true
    return { userInfo: user }
  })
  mocks.confirm.mockReset().mockResolvedValue(undefined)
})

it('uses the current session without requesting WeChat credentials or creating an account', async () => {
  mocks.loggedIn = true
  await authorize()
  expect(mocks.login).not.toHaveBeenCalled()
  expect(mocks.wechat).not.toHaveBeenCalled()
  expect(mocks.skip).not.toHaveBeenCalled()
  expect(mocks.confirm).toHaveBeenCalledWith(ticket)
})
it('signs a returning WeChat account in and continues authorization', async () => {
  await authorize()
  expect(mocks.wechat).toHaveBeenCalledWith('wx-code')
  expect(onUser).toHaveBeenCalledWith(user)
  expect(mocks.skip).not.toHaveBeenCalled()
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
})
it('creates a first-time WeChat account through the existing pending-login contract', async () => {
  mocks.wechat.mockResolvedValue({ pendingBind: true, pendingBindToken: 'pending-token' })
  await authorize()
  expect(mocks.skip).toHaveBeenCalledWith('pending-token')
  expect(onUser).toHaveBeenCalledWith(user)
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
})
it.each(['EXPIRED', 'CONFIRMED', 'CANCELLED'])(
  'rejects %s before even calling WeChat',
  async status => {
    mocks.status.mockResolvedValue({ status, expiresAt: Date.now() + 120000 })
    await expect(authorize()).rejects.toThrow('login.qrInvalid')
    expect(mocks.login).not.toHaveBeenCalled()
    expect(mocks.skip).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
  },
)
it('does not create an account if the QR expires during WeChat exchange', async () => {
  mocks.status.mockResolvedValueOnce(waiting()).mockResolvedValue({ status: 'EXPIRED' })
  mocks.wechat.mockResolvedValue({ pendingBind: true, pendingBindToken: 'pending-token' })
  await expect(authorize()).rejects.toThrow('login.qrInvalid')
  expect(mocks.skip).not.toHaveBeenCalled()
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('does not authorize a QR that expires after signing in', async () => {
  mocks.status.mockResolvedValueOnce(waiting()).mockResolvedValue({ status: 'EXPIRED' })
  await expect(authorize()).rejects.toThrow('login.qrInvalid')
  expect(mocks.loggedIn).toBe(true)
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('cancelling during WeChat login prevents exchange and authorization', async () => {
  mocks.login.mockImplementation(async () => {
    active = false
    return { code: 'wx-code' }
  })
  await expect(authorize()).rejects.toThrow('login.qrCancelled')
  expect(mocks.wechat).not.toHaveBeenCalled()
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('cancelling during exchange prevents account creation', async () => {
  mocks.wechat.mockImplementation(async () => {
    active = false
    return { pendingBind: true, pendingBindToken: 'pending-token' }
  })
  await expect(authorize()).rejects.toThrow('login.qrCancelled')
  expect(mocks.skip).not.toHaveBeenCalled()
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('keeps saved credentials and profile consistent when cancelling during sign-in', async () => {
  mocks.wechat.mockImplementation(async () => {
    active = false
    mocks.loggedIn = true
    return { userInfo: user }
  })
  await expect(authorize()).rejects.toThrow('login.qrCancelled')
  expect(onUser).toHaveBeenCalledWith(user)
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('keeps the profile consistent when cancellation races with account creation', async () => {
  mocks.wechat.mockResolvedValue({ pendingBind: true, pendingBindToken: 'pending-token' })
  mocks.skip.mockImplementation(async () => {
    active = false
    mocks.loggedIn = true
    return { userInfo: user }
  })
  await expect(authorize()).rejects.toThrow('login.qrCancelled')
  expect(onUser).toHaveBeenCalledWith(user)
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('missing pending credentials never create an account', async () => {
  mocks.wechat.mockResolvedValue({ pendingBind: true })
  await expect(authorize()).rejects.toThrow('login.bindCredentialExpired')
  expect(mocks.skip).not.toHaveBeenCalled()
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('missing WeChat credentials never attempt login', async () => {
  mocks.login.mockResolvedValue({})
  await expect(authorize()).rejects.toThrow('login.wxCredentialFailed')
  expect(mocks.wechat).not.toHaveBeenCalled()
})
it('does not authorize when the sign-in response failed to establish a session', async () => {
  mocks.wechat.mockResolvedValue({ userInfo: user })
  await expect(authorize()).rejects.toThrow('login.loginFailed')
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('never falls back to WeChat registration when an existing session expires mid-flight', async () => {
  mocks.loggedIn = true
  mocks.status.mockImplementation(async () => {
    mocks.loggedIn = false
    return waiting()
  })
  await expect(
    authorizeQrLogin(ticket, {
      active: () => true,
      onUser,
      allowWechatLogin: false,
    }),
  ).rejects.toThrow('login.qrSignInFirst')
  expect(mocks.login).not.toHaveBeenCalled()
  expect(mocks.wechat).not.toHaveBeenCalled()
  expect(mocks.skip).not.toHaveBeenCalled()
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('propagates confirmation failures without retrying the mutation', async () => {
  mocks.loggedIn = true
  mocks.confirm.mockRejectedValue(new Error('network failure'))
  await expect(authorize()).rejects.toThrow('network failure')
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
})
it('validates tickets locally and fails closed without an expiry', async () => {
  await expect(readWaitingQr('bad')).rejects.toThrow('login.qrInvalid')
  expect(mocks.status).not.toHaveBeenCalled()
  expect(isWaitingQr({ status: 'WAITING' })).toBe(false)
  expect(isWaitingQr({ status: 'WAITING', expiresAt: NaN })).toBe(false)
  expect(isWaitingQr({ status: 'WAITING', expiresAt: 100 }, 100)).toBe(false)
  expect(isWaitingQr({ status: 'SCANNED', expiresAt: 101 }, 100)).toBe(true)
})
