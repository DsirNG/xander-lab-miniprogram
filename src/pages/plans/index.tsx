import { ThemeView } from '@/components/ThemeView'
import { ScrollView, View } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { NavBar } from '@/components/NavBar'
import { PlansContent } from '@/features/plans/PlansContent'
import { usePlansController } from '@/features/plans/usePlansController'
import { t, useLocale } from '@/i18n'
import '@/features/plans/PlansContent.scss'

export default function PlansPage() {
  useLocale()
  const [pageShowCount, setPageShowCount] = useState(0)
  useDidShow(() => setPageShowCount(count => count + 1))
  const controller = usePlansController(true, pageShowCount)
  return (
    <ThemeView style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <NavBar title={t('ui.plans')} showBack />
      <ScrollView scrollY style={{ flex: 1, minHeight: 0 }} onScrollToLower={controller.loadMore}>
        <PlansContent controller={controller} />
      </ScrollView>
    </ThemeView>
  )
}
