import { ThemeView } from '@/components/ThemeView'
import { Text, View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { NavBar } from '@/components/NavBar'
import { t, useLocale } from '@/i18n'

export default function LegalPage() {
  useLocale()
  const [type, setType] = useState<'terms' | 'privacy'>('terms')
  useLoad(params => setType(params?.type === 'privacy' ? 'privacy' : 'terms'))
  const title = t(type === 'terms' ? 'login.agreementTitle' : 'login.privacyTitle')

  return (
    <ThemeView className="page legal-page">
      <NavBar title={title} showBack />
      <View style={{ padding: '16px', lineHeight: 1.7 }}>
        {t(type === 'terms' ? 'login.termsBody' : 'login.privacyBody')
          .split('\n\n')
          .map((paragraph, index) => (
            <Text key={index} style={{ display: 'block', marginBottom: '16px' }}>
              {paragraph}
            </Text>
          ))}
      </View>
    </ThemeView>
  )
}
