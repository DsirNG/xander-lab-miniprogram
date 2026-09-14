import type { IconDefinition } from '../types'

const calendar: IconDefinition = {
  width: 24,
  height: 24,
  strokeWidth: 2,
  lineCap: 'round',
  lineJoin: 'round',
  nodes: [
    { type: 'rect', x: 3, y: 4, width: 18, height: 18, rx: 2, role: 'base' },
    { type: 'line', x1: 16, y1: 2, x2: 16, y2: 6, role: 'base' },
    { type: 'line', x1: 8, y1: 2, x2: 8, y2: 6, role: 'base' },
    { type: 'line', x1: 3, y1: 10, x2: 21, y2: 10, role: 'base' },
    { type: 'rect', x: 3, y: 4, width: 18, height: 18, rx: 2, role: 'draw' },
    { type: 'line', x1: 3, y1: 10, x2: 21, y2: 10, role: 'draw' },
    { type: 'line', x1: 16, y1: 2, x2: 16, y2: 6, role: 'draw' },
    { type: 'line', x1: 8, y1: 2, x2: 8, y2: 6, role: 'draw' },
  ],
}

export default calendar
