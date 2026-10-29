import './app.scss'
import Taro from '@tarojs/taro'
import { useEffect, type ReactNode } from 'react'
import { useUserStore } from '@/store/user'

export default function App({ children }: { children: ReactNode }) {
  const refreshUser = useUserStore(state => state.refresh)
  const setUser = useUserStore(state => state.setUser)

  useEffect(() => {
    refreshUser().catch(() => undefined)
  }, [refreshUser])

  useEffect(() => {
    const handleLogout = () => {
      setUser(null)
      const pages = Taro.getCurrentPages()
      if (pages[pages.length - 1]?.route !== 'pages/login/index') {
        void Taro.navigateTo({ url: '/pages/login/index' }).catch(() => undefined)
      }
    }
    Taro.eventCenter.on('auth:logout', handleLogout)
    return () => {
      Taro.eventCenter.off('auth:logout', handleLogout)
    }
  }, [setUser])

  return children
}
