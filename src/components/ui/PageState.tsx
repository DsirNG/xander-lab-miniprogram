import type { ReactNode } from 'react'
import { View } from '@tarojs/components'
import './PageState.scss'

export type PageStateKind = 'empty' | 'loading' | 'error'

export interface PageStateProps {
  kind?: PageStateKind
  icon?: ReactNode
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function PageState({
  kind = 'empty',
  icon,
  title,
  description,
  action,
  className = '',
}: PageStateProps) {
  return (
    <View className={`ui-page-state ui-page-state--${kind} ${className}`.trim()}>
      {kind === 'loading' ? (
        <View className="ui-page-state-dots">
          <View />
          <View />
          <View />
        </View>
      ) : null}
      {icon ? <View className="ui-page-state-icon">{icon}</View> : null}
      {title ? <View className="ui-page-state-title">{title}</View> : null}
      {description ? <View className="ui-page-state-description">{description}</View> : null}
      {action ? <View className="ui-page-state-action">{action}</View> : null}
    </View>
  )
}
