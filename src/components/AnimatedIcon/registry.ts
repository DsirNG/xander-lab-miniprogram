import chat from './definitions/chat'
import files from './definitions/files'
import article from './definitions/article'
import user from './definitions/user'
import type { AnimatedIconName, IconDefinition } from './types'

export const iconRegistry: Record<AnimatedIconName, IconDefinition> = {
  chat,
  files,
  article,
  user,
}

export type { AnimatedIconName, IconDefinition, IconNode, IconRole, PathCommand } from './types'
