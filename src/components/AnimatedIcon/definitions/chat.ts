import type { IconDefinition } from '../types'

const chat: IconDefinition = {
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
        { type: 'M', x: 21, y: 12 },
        { type: 'C', x1: 21, y1: 16.97, x2: 17, y2: 20, x: 12, y: 20 },
        { type: 'C', x1: 10.5, y1: 20, x2: 9.15, y2: 19.6, x: 8, y: 19 },
        { type: 'L', x: 3, y: 21 },
        { type: 'L', x: 4.6, y: 16 },
        { type: 'C', x1: 3.6, y1: 14.8, x2: 3, y2: 13.5, x: 3, y: 12 },
        { type: 'C', x1: 3, y1: 7, x2: 7, y2: 3, x: 12, y: 3 },
        { type: 'C', x1: 17, y1: 3, x2: 21, y2: 7, x: 21, y: 12 },
        { type: 'Z' },
      ],
    },
    {
      type: 'path',
      role: 'draw',
      length: 57,
      commands: [
        { type: 'M', x: 21, y: 12 },
        { type: 'C', x1: 21, y1: 16.97, x2: 17, y2: 20, x: 12, y: 20 },
        { type: 'C', x1: 10.5, y1: 20, x2: 9.15, y2: 19.6, x: 8, y: 19 },
        { type: 'L', x: 3, y: 21 },
        { type: 'L', x: 4.6, y: 16 },
        { type: 'C', x1: 3.6, y1: 14.8, x2: 3, y2: 13.5, x: 3, y: 12 },
        { type: 'C', x1: 3, y1: 7, x2: 7, y2: 3, x: 12, y: 3 },
        { type: 'C', x1: 17, y1: 3, x2: 21, y2: 7, x: 21, y: 12 },
        { type: 'Z' },
      ],
    },
  ],
}

export default chat
