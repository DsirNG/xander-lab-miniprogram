import { describe, expect, it, vi } from 'vitest'
import { drawIcon } from './WeappCanvasRenderer'
import type { IconDefinition } from '../types'

vi.mock('@tarojs/taro', () => ({ default: {} }))

function createRuntime() {
  const context = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    stroke: vi.fn(),
    setTransform: vi.fn(),
    strokeStyle: '',
    lineWidth: 2,
    lineCap: 'round',
    lineJoin: 'round',
    globalAlpha: 1,
  }
  return {
    context,
    size: 24,
    ratio: 1,
    canvas: { width: 24, height: 24, getContext: () => context },
  }
}

describe('icon stroke drawing', () => {
  const definition: IconDefinition = {
    width: 24,
    height: 24,
    nodes: [
      { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0, role: 'draw' },
      { type: 'line', x1: 10, y1: 0, x2: 10, y2: 10, role: 'draw' },
    ],
  }

  it('extends the pen along each stroke instead of revealing the finished icon through a clip', () => {
    const runtime = createRuntime()
    drawIcon(runtime, definition, 0.25, '#000')
    expect(runtime.context.lineTo.mock.calls).toEqual([[5, 0]])
    expect(runtime.context.clip).not.toHaveBeenCalled()
    runtime.context.lineTo.mockClear()
    drawIcon(runtime, definition, 0.75, '#000')
    expect(runtime.context.lineTo.mock.calls).toEqual([
      [10, 0],
      [10, 5],
    ])
    drawIcon(runtime, definition, 1, '#000')
    expect(runtime.context.lineTo).toHaveBeenLastCalledWith(10, 10)
  })

  it('draws a partial circular outline rather than a complete circle', () => {
    const runtime = createRuntime()
    drawIcon(
      runtime,
      { width: 24, height: 24, nodes: [{ type: 'circle', cx: 12, cy: 12, r: 4, role: 'draw' }] },
      0.5,
      '#000',
    )
    expect(runtime.context.arc).toHaveBeenCalledExactlyOnceWith(
      12,
      12,
      4,
      -Math.PI / 2,
      Math.PI / 2,
    )
    expect(runtime.context.clip).not.toHaveBeenCalled()
  })
})
