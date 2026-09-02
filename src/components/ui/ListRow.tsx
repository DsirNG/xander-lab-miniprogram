import type { ReactNode } from 'react'
import { View } from '@tarojs/components'
import './ListRow.scss'

export interface ListRowProps {
  leading?: ReactNode
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  className?: string
}

export function ListRow({
  leading,
  title,
  description,
  meta,
  trailing,
  onClick,
  className = '',
}: ListRowProps) {
  return (
    <View
      className={`ui-list-row ${onClick ? 'ui-list-row--interactive' : ''} ${className}`.trim()}
      hoverClass={onClick ? 'ui-list-row--pressed' : 'none'}
      onClick={onClick}
    >
      {leading ? <View className="ui-list-row-leading">{leading}</View> : null}
      <View className="ui-list-row-content">
        <View className="ui-list-row-title">{title}</View>
        {description ? <View className="ui-list-row-description">{description}</View> : null}
        {meta ? <View className="ui-list-row-meta">{meta}</View> : null}
      </View>
      {trailing ? <View className="ui-list-row-trailing">{trailing}</View> : null}
    </View>
  )
}
