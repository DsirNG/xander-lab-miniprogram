import chat from './definitions/chat'
import calendar from './definitions/calendar'
import article from './definitions/article'
import user from './definitions/user'
import type { AnimatedIconName, IconDefinition } from './types'

export const iconRegistry: Record<AnimatedIconName, IconDefinition> = {
  chat,
  calendar,
  article,
  user,
}

export type { AnimatedIconName, IconDefinition, IconNode, IconRole, PathCommand } from './types'
