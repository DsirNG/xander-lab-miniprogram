import type { IconDefinition } from '../types'

const user: IconDefinition = {
  width: 24,
  height: 24,
  strokeWidth: 2,
  lineCap: 'round',
  lineJoin: 'round',
  nodes: [
    {
      type: 'path',
      role: 'base',
      commands: [
        { type: 'M', x: 20, y: 21 },
        { type: 'L', x: 20, y: 19 },
        { type: 'C', x1: 20, y1: 16.8, x2: 18.2, y2: 15, x: 16, y: 15 },
        { type: 'L', x: 8, y: 15 },
        { type: 'C', x1: 5.8, y1: 15, x2: 4, y2: 16.8, x: 4, y: 19 },
        { type: 'L', x: 4, y: 21 },
      ],
    },
    { type: 'circle', cx: 12, cy: 7, r: 4, role: 'base' },
    {
      type: 'path',
      role: 'draw',
      length: 19,
      commands: [
        { type: 'M', x: 20, y: 21 },
        { type: 'L', x: 20, y: 19 },
        { type: 'C', x1: 20, y1: 16.8, x2: 18.2, y2: 15, x: 16, y: 15 },
        { type: 'L', x: 8, y: 15 },
        { type: 'C', x1: 5.8, y1: 15, x2: 4, y2: 16.8, x: 4, y: 19 },
        { type: 'L', x: 4, y: 21 },
      ],
    },
    { type: 'circle', cx: 12, cy: 7, r: 4, role: 'draw' },
  ],
}

export default user
