import Taro from '@tarojs/taro'
import { authApi, type QrLoginStatus, type TokenResponse, type UserInfo } from '@/api/auth'
import { t } from '@/i18n'

export function isWaitingQr(state: QrLoginStatus, now = Date.now()): boolean {
  return (
    ['WAITING', 'SCANNED'].includes(state.status) &&
    typeof state.expiresAt === 'number' &&
    Number.isFinite(state.expiresAt) &&
    state.expiresAt > now
  )
}

export async function readWaitingQr(ticket: string): Promise<QrLoginStatus> {
  if (!/^[a-f0-9]{32}$/.test(ticket)) throw new Error(t('login.qrInvalid'))
  const state = await authApi.qrStatus(ticket)
  if (!isWaitingQr(state)) throw new Error(t('login.qrInvalid'))
  return state
}

/** 只有用户明确确认后调用；异步步骤之间检查页面是否仍然有效。 */
export async function authorizeQrLogin(
  ticket: string,
  options: {
    active: () => boolean
    onUser: (user: UserInfo) => void
    allowWechatLogin: boolean
  },
) {
  const checkActive = () => {
    if (!options.active()) throw new Error(t('login.qrCancelled'))
  }
  const syncSession = (response: TokenResponse) => {
    // API 已保存凭据时，即使用户取消了网页授权，也必须同步小程序账号资料。
    if (response.userInfo && authApi.isLoggedIn()) options.onUser(response.userInfo)
  }
  checkActive()
  await readWaitingQr(ticket)
  checkActive()
  if (!authApi.isLoggedIn()) {
    // 会话可能在读取二维码期间失效，不能因此替已登录用户选择另一个微信账号。
    if (!options.allowWechatLogin) throw new Error(t('login.qrSignInFirst'))
    const credential = await Taro.login()
    checkActive()
    if (!credential.code) throw new Error(t('login.wxCredentialFailed'))
    let response = await authApi.wechatLogin(credential.code)
    syncSession(response)
    checkActive()
    if (response.pendingBind) {
      if (!response.pendingBindToken) throw new Error(t('login.bindCredentialExpired'))
      // 微信交互后可能已超过二维码有效期，建号前再验证一次。
      await readWaitingQr(ticket)
      checkActive()
      response = await authApi.skipBind(response.pendingBindToken)
      syncSession(response)
    }
    checkActive()
    if (!authApi.isLoggedIn() || !response.userInfo) throw new Error(t('login.loginFailed'))
  }
  await readWaitingQr(ticket)
  checkActive()
  await authApi.confirmQrLogin(ticket)
}
