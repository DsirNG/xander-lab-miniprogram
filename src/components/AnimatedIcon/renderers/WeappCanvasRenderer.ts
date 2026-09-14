import Taro from '@tarojs/taro'
import type { IconDefinition, IconNode, PathCommand } from '../types'

type CanvasContextLike = {
  clearRect: (x: number, y: number, width: number, height: number) => void
  beginPath: () => void
  closePath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  bezierCurveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => void
  quadraticCurveTo: (x1: number, y1: number, x: number, y: number) => void
  arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number) => void
  rect: (x: number, y: number, width: number, height: number) => void
  stroke: () => void
  setTransform?: (a: number, b: number, c: number, d: number, e: number, f: number) => void
  setLineDash?: (segments: number[]) => void
  lineDashOffset?: number
  strokeStyle: string
  lineWidth: number
  lineCap: string
  lineJoin: string
  globalAlpha: number
}

type CanvasNodeLike = {
  width: number
  height: number
  getContext: (type: '2d') => CanvasContextLike
}

type CanvasRuntime = {
  canvas: CanvasNodeLike
  context: CanvasContextLike
  size: number
  ratio: number
}

function mixHexColors(from: string, to: string, progress: number) {
  const fromMatch = /^#([\da-f]{6})$/i.exec(from)
  const toMatch = /^#([\da-f]{6})$/i.exec(to)
  if (!fromMatch || !toMatch) return progress >= 0.5 ? to : from

  const fromValue = Number.parseInt(fromMatch[1], 16)
  const toValue = Number.parseInt(toMatch[1], 16)
  const channel = (shift: number) => {
    const start = (fromValue >> shift) & 0xff
    const end = (toValue >> shift) & 0xff
    return Math.round(start + (end - start) * progress)
  }

  return `#${[16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, '0')).join('')}`
}

function drawCommands(context: CanvasContextLike, commands: PathCommand[]) {
  context.beginPath()

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        context.moveTo(command.x, command.y)
        break
      case 'L':
        context.lineTo(command.x, command.y)
        break
      case 'C':
        context.bezierCurveTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y)
        break
      case 'Q':
        context.quadraticCurveTo(command.x1, command.y1, command.x, command.y)
        break
      case 'Z':
        context.closePath()
        break
    }
  }
}

function strokeWithProgress(
  context: CanvasContextLike,
  progress: number,
  length: number,
  draw: () => void,
) {
  if (progress <= 0) return

  if (progress >= 1 || !context.setLineDash) {
    draw()
    return
  }

  context.setLineDash([length, length])
  context.lineDashOffset = length * (1 - progress)
  draw()
  context.setLineDash([])
  context.lineDashOffset = 0
}

function drawNode(context: CanvasContextLike, node: IconNode, progress: number) {
  if (node.role === 'draw' && progress <= 0) return

  if (node.type === 'line') {
    const ratio = node.role === 'draw' ? Math.min(1, Math.max(0, progress)) : 1
    const x = node.x1 + (node.x2 - node.x1) * ratio
    const y = node.y1 + (node.y2 - node.y1) * ratio
    context.beginPath()
    context.moveTo(node.x1, node.y1)
    context.lineTo(x, y)
    context.stroke()
    return
  }

  if (node.type === 'circle') {
    const ratio = node.role === 'draw' ? Math.min(1, Math.max(0, progress)) : 1
    context.beginPath()
    context.arc(node.cx, node.cy, node.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
    context.stroke()
    return
  }

  if (node.type === 'rect') {
    const perimeter = (node.width + node.height) * 2
    strokeWithProgress(context, node.role === 'draw' ? progress : 1, perimeter, () => {
      context.beginPath()
      if (node.rx && node.rx > 0) {
        const radius = Math.min(node.rx, node.width / 2, node.height / 2)
        context.moveTo(node.x + radius, node.y)
        context.lineTo(node.x + node.width - radius, node.y)
        context.lineTo(node.x + node.width, node.y + radius)
        context.lineTo(node.x + node.width, node.y + node.height - radius)
        context.lineTo(node.x + node.width - radius, node.y + node.height)
        context.lineTo(node.x + radius, node.y + node.height)
        context.lineTo(node.x, node.y + node.height - radius)
        context.lineTo(node.x, node.y + radius)
        context.closePath()
      } else {
        context.rect(node.x, node.y, node.width, node.height)
      }
      context.stroke()
    })
    return
  }

  const length = node.length ?? 100
  strokeWithProgress(context, node.role === 'draw' ? progress : 1, length, () => {
    drawCommands(context, node.commands)
    context.stroke()
  })
}

export function drawIcon(
  runtime: CanvasRuntime,
  definition: IconDefinition,
  progress: number,
  inactiveColor: string,
  activeColor: string,
) {
  const { context, size, ratio } = runtime
  const scale = (size / definition.width) * ratio

  context.setTransform?.(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, runtime.canvas.width, runtime.canvas.height)
  context.setTransform?.(scale, 0, 0, scale, 0, 0)
  context.strokeStyle = mixHexColors(inactiveColor, activeColor, progress)
  context.lineWidth = definition.strokeWidth ?? 2
  context.lineCap = definition.lineCap ?? 'round'
  context.lineJoin = definition.lineJoin ?? 'round'

  context.globalAlpha = 0.68 + 0.32 * progress
  definition.nodes.filter(node => node.role !== 'draw').forEach(node => drawNode(context, node, 1))

  context.globalAlpha = progress
  definition.nodes
    .filter(node => node.role === 'draw')
    .forEach(node => drawNode(context, node, progress))
  context.globalAlpha = 1
}

export async function getCanvasRuntime(
  canvasId: string,
  size: number,
): Promise<CanvasRuntime | null> {
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) return null

  return new Promise(resolve => {
    Taro.nextTick(() => {
      try {
        Taro.createSelectorQuery()
          .select(`#${canvasId}`)
          .fields({ node: true, size: true })
          .exec((result: Array<{ node?: CanvasNodeLike; width?: number; height?: number }>) => {
            try {
              const entry = result?.[0]
              if (!entry?.node) {
                resolve(null)
                return
              }

              const canvas = entry.node
              const context = canvas.getContext('2d')
              const ratio = Taro.getWindowInfo().pixelRatio || 1
              const measuredSize = entry.width || size

              canvas.width = measuredSize * ratio
              canvas.height = measuredSize * ratio

              resolve({ canvas, context, size: measuredSize, ratio })
            } catch {
              resolve(null)
            }
          })
      } catch {
        resolve(null)
      }
    })
  })
}
