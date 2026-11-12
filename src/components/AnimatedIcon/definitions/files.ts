import type { IconDefinition } from '../types'

const files: IconDefinition = {
  width: 24,
  height: 24,
  strokeWidth: 2,
  lineCap: 'round',
  lineJoin: 'round',
  nodes: [
    { type: 'rect', x: 3, y: 7, width: 18, height: 13, rx: 2, role: 'base' },
    { type: 'line', x1: 5, y1: 4, x2: 10, y2: 4, role: 'base' },
    { type: 'line', x1: 10, y1: 4, x2: 13, y2: 7, role: 'base' },
    { type: 'rect', x: 3, y: 7, width: 18, height: 13, rx: 2, role: 'draw' },
    { type: 'line', x1: 5, y1: 4, x2: 10, y2: 4, role: 'draw' },
    { type: 'line', x1: 10, y1: 4, x2: 13, y2: 7, role: 'draw' },
  ],
}

export default files
