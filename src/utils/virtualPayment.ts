import Taro from '@tarojs/taro'
import { virtualPayApi, type VirtualPayData } from '@/api/virtualPay'
import { t } from '@/i18n'

type VirtualPaymentRuntime = {
  requestVirtualPayment: (
    options: VirtualPayData & {
      success: () => void
      fail: (error: { errMsg?: string; errCode?: number }) => void
    },
  ) => void
}

function compareVersion(left: string, right: string) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function requestVirtualPayment(payData: VirtualPayData) {
  return new Promise<void>((resolve, reject) => {
    const runtime = Taro as unknown as VirtualPaymentRuntime
    runtime.requestVirtualPayment({
      ...payData,
      success: resolve,
      fail: reject,
    })
  })
}

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export const ensureRuntime = () => {
    if (process.env.TARO_ENV !== 'weapp' || !Taro.canIUse('requestVirtualPayment')) {
      Taro.showToast({ title: t('subscription.wechatOnly'), icon: 'none' })
      return false
    }
    const system = Taro.getSystemInfoSync()
    if (system.platform === 'ios' && compareVersion(system.version || '0', '8.0.68') < 0) {
      Taro.showToast({ title: t('subscription.updateWechat'), icon: 'none' })
      return false
    }
    return true
  }

export const confirmDelivered = async (outTradeNo: string) => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const order = await virtualPayApi.reconcile(outTradeNo)
      if (order.status === 'DELIVERED') return true
      await wait(1500)
    }
    return false
  }

