import type { IconDefinition } from '../types'

const article: IconDefinition = {
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
        { type: 'M', x: 14, y: 2 },
        { type: 'L', x: 6, y: 2 },
        { type: 'C', x1: 4.9, y1: 2, x2: 4, y2: 2.9, x: 4, y: 4 },
        { type: 'L', x: 4, y: 20 },
        { type: 'C', x1: 4, y1: 21.1, x2: 4.9, y2: 22, x: 6, y: 22 },
        { type: 'L', x: 18, y: 22 },
        { type: 'C', x1: 19.1, y1: 22, x2: 20, y2: 21.1, x: 20, y: 20 },
        { type: 'L', x: 20, y: 8 },
        { type: 'L', x: 14, y: 2 },
        { type: 'Z' },
      ],
    },
    {
      type: 'path',
      role: 'base',
      commands: [
        { type: 'M', x: 14, y: 2 },
        { type: 'L', x: 14, y: 8 },
        { type: 'L', x: 20, y: 8 },
      ],
    },
    { type: 'line', x1: 16, y1: 13, x2: 8, y2: 13, role: 'base' },
    { type: 'line', x1: 16, y1: 17, x2: 8, y2: 17, role: 'base' },
    {
      type: 'path',
      role: 'base',
      commands: [
        { type: 'M', x: 10, y: 9 },
        { type: 'L', x: 9, y: 9 },
        { type: 'L', x: 8, y: 9 },
      ],
    },
    { type: 'line', x1: 16, y1: 13, x2: 8, y2: 13, role: 'draw' },
    { type: 'line', x1: 16, y1: 17, x2: 8, y2: 17, role: 'draw' },
    {
      type: 'path',
      role: 'draw',
      length: 8,
      commands: [
        { type: 'M', x: 14, y: 2 },
        { type: 'L', x: 14, y: 8 },
        { type: 'L', x: 20, y: 8 },
      ],
    },
  ],
}

export default article
