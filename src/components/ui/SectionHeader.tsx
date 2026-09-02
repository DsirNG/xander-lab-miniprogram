import type { ReactNode } from 'react'
import { View } from '@tarojs/components'
import './SectionHeader.scss'

export interface SectionHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, description, action, className = '' }: SectionHeaderProps) {
  return (
    <View className={`ui-section-header ${className}`.trim()}>
      <View className="ui-section-header-copy">
        <View className="ui-section-header-title">{title}</View>
        {description ? <View className="ui-section-header-description">{description}</View> : null}
      </View>
      {action ? <View className="ui-section-header-action">{action}</View> : null}
    </View>
  )
}
