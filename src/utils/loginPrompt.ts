import Taro from '@tarojs/taro'
import { t } from '@/i18n'

let prompting = false
let continuation: (() => void) | undefined

/** 扫码页已经明确请求登录，无需再弹一次登录提示。 */
export async function openLogin(afterLogin: () => void, query = '') {
  continuation = afterLogin
  try {
    await Taro.navigateTo({ url: `/pages/login/index${query}` })
  } catch (error) {
    continuation = undefined
    throw error
  }
}

export async function promptLogin(afterLogin?: () => void) {
  if (prompting || Taro.getCurrentPages().slice(-1)[0]?.route === 'pages/login/index') return
  prompting = true
  try {
    const answer = await Taro.showModal({
      title: t('login.promptTitle'),
      content: t('login.promptBody'),
      confirmText: t('login.promptYes'),
      cancelText: t('login.promptNo'),
    })
    if (!answer.confirm) return
    continuation = afterLogin
    await Taro.navigateTo({ url: '/pages/login/index' })
  } catch {
    continuation = undefined
  } finally {
    prompting = false
  }
}

export function takeLoginContinuation() {
  const next = continuation
  continuation = undefined
  return next
}
