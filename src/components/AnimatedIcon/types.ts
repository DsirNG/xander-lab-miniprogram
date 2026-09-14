export type IconRole = 'base' | 'draw'

export type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | {
      type: 'C'
      x1: number
      y1: number
      x2: number
      y2: number
      x: number
      y: number
    }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'Z' }

export type IconNode =
  | {
      type: 'path'
      commands: PathCommand[]
      role?: IconRole
      length?: number
    }
  | {
      type: 'line'
      x1: number
      y1: number
      x2: number
      y2: number
      role?: IconRole
    }
  | {
      type: 'rect'
      x: number
      y: number
      width: number
      height: number
      rx?: number
      role?: IconRole
    }
  | {
      type: 'circle'
      cx: number
      cy: number
      r: number
      role?: IconRole
    }

export type IconDefinition = {
  width: number
  height: number
  strokeWidth?: number
  lineCap?: 'round' | 'butt' | 'square'
  lineJoin?: 'round' | 'bevel' | 'miter'
  nodes: IconNode[]
}

export type AnimatedIconName = 'chat' | 'calendar' | 'article' | 'user'
