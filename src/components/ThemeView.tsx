import { View } from '@tarojs/components'
import { useEffect, type ComponentProps } from 'react'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { dismissActionSheet } from '@/utils/actionSheet'
import { ActionSheet } from './ui/ActionSheet'
import { useDarkMode } from '@/hooks/useDarkMode'

export function ThemeView({ className = '', children, ...props }: ComponentProps<typeof View>) {
  const dark = useDarkMode()
  useDidHide(dismissActionSheet)
  const background = dark ? '#121214' : '#ffffff'
  const syncBackground = () => {
    if (process.env.TARO_ENV !== 'weapp') return
    void Taro.setBackgroundColor?.({
      backgroundColor: background,
      backgroundColorTop: background,
      backgroundColorBottom: background,
    })?.catch(() => undefined)
    void Taro.setNavigationBarColor?.({
      frontColor: dark ? '#ffffff' : '#000000',
      backgroundColor: background,
      animation: { duration: 0, timingFunc: 'linear' },
    })?.catch(() => undefined)
    void Taro.setBackgroundTextStyle?.({ textStyle: dark ? 'light' : 'dark' })?.catch(() => undefined)
  }
  useDidShow(syncBackground)
  useEffect(syncBackground, [background])
  return (
    <View {...props} className={`theme-page ${dark ? 'theme-dark' : 'theme-light'} ${className}`}>
      <View className="theme-page-backdrop" style={{ backgroundColor: background }} />
      {children}
      <ActionSheet />
    </View>
  )
}
