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
  save?: () => void
  restore?: () => void
  clip?: () => void
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

type Point = { x: number; y: number }

type Polyline = {
  points: Point[]
  length: number
}

const PATH_SAMPLES = 12

function distance(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y)
}

function pushPolyline(polylines: Polyline[], points: Point[]) {
  if (points.length < 2) return

  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index])
  }

  if (length > 0) polylines.push({ points, length })
}

function getPathPolylines(commands: PathCommand[]): Polyline[] {
  const polylines: Polyline[] = []
  let current: Point = { x: 0, y: 0 }
  let subpathStart: Point = current

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        current = { x: command.x, y: command.y }
        subpathStart = current
        break
      case 'L': {
        const next = { x: command.x, y: command.y }
        pushPolyline(polylines, [current, next])
        current = next
        break
      }
      case 'C': {
        const points = [current]
        for (let step = 1; step <= PATH_SAMPLES; step += 1) {
          const t = step / PATH_SAMPLES
          const inverse = 1 - t
          points.push({
            x:
              inverse * inverse * inverse * current.x +
              3 * inverse * inverse * t * command.x1 +
              3 * inverse * t * t * command.x2 +
              t * t * t * command.x,
            y:
              inverse * inverse * inverse * current.y +
              3 * inverse * inverse * t * command.y1 +
              3 * inverse * t * t * command.y2 +
              t * t * t * command.y,
          })
        }
        pushPolyline(polylines, points)
        current = { x: command.x, y: command.y }
        break
      }
      case 'Q': {
        const points = [current]
        for (let step = 1; step <= PATH_SAMPLES; step += 1) {
          const t = step / PATH_SAMPLES
          const inverse = 1 - t
          points.push({
            x: inverse * inverse * current.x + 2 * inverse * t * command.x1 + t * t * command.x,
            y: inverse * inverse * current.y + 2 * inverse * t * command.y1 + t * t * command.y,
          })
        }
        pushPolyline(polylines, points)
        current = { x: command.x, y: command.y }
        break
      }
      case 'Z':
        pushPolyline(polylines, [current, subpathStart])
        current = subpathStart
        break
    }
  }

  return polylines
}

function drawProgressivePolylines(
  context: CanvasContextLike,
  polylines: Polyline[],
  progress: number,
) {
  const target = Math.max(0, Math.min(1, progress))
  if (target <= 0 || polylines.length === 0) return

  const totalLength = polylines.reduce((total, polyline) => total + polyline.length, 0)
  let remaining = totalLength * target

  context.beginPath()

  for (const polyline of polylines) {
    if (remaining <= 0) break

    context.moveTo(polyline.points[0].x, polyline.points[0].y)
    let consumed = 0

    for (let index = 1; index < polyline.points.length; index += 1) {
      const from = polyline.points[index - 1]
      const to = polyline.points[index]
      const segmentLength = distance(from, to)

      if (consumed + segmentLength <= remaining) {
        context.lineTo(to.x, to.y)
        consumed += segmentLength
        continue
      }

      const ratio = segmentLength === 0 ? 0 : (remaining - consumed) / segmentLength
      context.lineTo(from.x + (to.x - from.x) * ratio, from.y + (to.y - from.y) * ratio)
      remaining = 0
      break
    }

    remaining -= Math.min(polyline.length, Math.max(0, consumed))
  }

  context.stroke()
}

function getRoundedRectPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  rx = 0,
): Point[] {
  const radius = Math.min(Math.max(0, rx), width / 2, height / 2)
  return [
    { x: x + radius, y },
    { x: x + width - radius, y },
    { x: x + width, y: y + radius },
    { x: x + width, y: y + height - radius },
    { x: x + width - radius, y: y + height },
    { x: x + radius, y: y + height },
    { x, y: y + height - radius },
    { x, y: y + radius },
    { x: x + radius, y },
  ]
}

function getPolylineLength(points: Point[]) {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index])
  }
  return length
}

function getNodeLength(node: IconNode) {
  if (node.type === 'line') return distance({ x: node.x1, y: node.y1 }, { x: node.x2, y: node.y2 })
  if (node.type === 'circle') return Math.PI * 2 * node.r
  if (node.type === 'rect')
    return getPolylineLength(getRoundedRectPoints(node.x, node.y, node.width, node.height, node.rx))
  return getPathPolylines(node.commands).reduce((total, polyline) => total + polyline.length, 0)
}

function clampProgress(progress: number) {
  return Math.max(0, Math.min(1, progress))
}

function clipDiagonalReveal(
  context: CanvasContextLike,
  width: number,
  height: number,
  progress: number,
) {
  const threshold = clampProgress(progress) * 2
  context.beginPath()

  if (threshold <= 1) {
    context.moveTo(0, 0)
    context.lineTo(width * threshold, 0)
    context.lineTo(0, height * threshold)
  } else {
    context.moveTo(0, 0)
    context.lineTo(width, 0)
    context.lineTo(width, height * (threshold - 1))
    context.lineTo(width * (threshold - 1), height)
    context.lineTo(0, height)
  }

  context.closePath()
  context.clip?.()
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
    const points = getRoundedRectPoints(node.x, node.y, node.width, node.height, node.rx)
    if (node.role === 'draw') {
      drawProgressivePolylines(
        context,
        [
          {
            points,
            length: points.reduce((total, point, index) => {
              if (index === 0) return total
              return total + distance(points[index - 1], point)
            }, 0),
          },
        ],
        progress,
      )
    } else {
      context.beginPath()
      context.moveTo(points[0].x, points[0].y)
      points.slice(1).forEach(point => context.lineTo(point.x, point.y))
      context.stroke()
    }
    return
  }

  if (node.role === 'draw') {
    drawProgressivePolylines(context, getPathPolylines(node.commands), progress)
    return
  }

  drawCommands(context, node.commands)
  context.stroke()
}

export function drawIcon(
  runtime: CanvasRuntime,
  definition: IconDefinition,
  progress: number,
  activeColor: string,
) {
  const { context, size, ratio } = runtime
  const scale = (size / definition.width) * ratio

  context.setTransform?.(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, runtime.canvas.width, runtime.canvas.height)
  context.setTransform?.(scale, 0, 0, scale, 0, 0)
  const clampedProgress = clampProgress(progress)
  context.lineWidth = definition.strokeWidth ?? 2
  context.lineCap = definition.lineCap ?? 'round'
  context.lineJoin = definition.lineJoin ?? 'round'

  // Only the active stroke is painted on Canvas. The inactive SVG remains
  // visible beneath it until this icon becomes selected.
  context.strokeStyle = activeColor
  context.globalAlpha = 1
  if (clampedProgress <= 0) return

  // Reveal the active stroke diagonally from the top-left to the bottom-right
  // over the full 0 -> 1 range.
  context.strokeStyle = activeColor
  context.globalAlpha = 1

  // Treat the whole icon as one 0 → 1 drawing timeline. Each draw node gets
  // only its portion of that timeline, so the stroke progresses in path order
  // instead of every line starting at zero at the same time.
  const drawNodes = definition.nodes.filter(node => node.role === 'draw')
  if (context.save && context.restore && context.clip) {
    context.save()
    clipDiagonalReveal(context, definition.width, definition.height, clampedProgress)
    drawNodes.forEach(node => drawNode(context, node, 1))
    context.restore()
    context.globalAlpha = 1
    return
  }
  const totalLength = drawNodes.reduce((total, node) => total + getNodeLength(node), 0)
  let offset = 0

  drawNodes.forEach(node => {
    const nodeLength = getNodeLength(node)
    const start = totalLength > 0 ? offset / totalLength : 0
    const end = totalLength > 0 ? (offset + nodeLength) / totalLength : 1
    const nodeProgress =
      end > start ? clampProgress((clampedProgress - start) / (end - start)) : clampedProgress
    drawNode(context, node, nodeProgress)
    offset += nodeLength
  })
  context.globalAlpha = 1
}

export async function getCanvasRuntime(
  canvasId: string,
  size: number,
): Promise<CanvasRuntime | null> {
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
    console.log('[AnimatedIcon] CANVAS_SKIP_ENV', { canvasId, env: Taro.getEnv() })
    return null
  }

  return new Promise(resolve => {
    let attempt = 0

    const queryCanvas = () => {
      Taro.nextTick(() => {
        try {
          Taro.createSelectorQuery()
            .select(`#${canvasId}`)
            .fields({ node: true, size: true })
            .exec((result: Array<{ node?: CanvasNodeLike; width?: number; height?: number }>) => {
              try {
                const entry = result?.[0]
                if (!entry?.node) {
                  if (attempt < 3) {
                    attempt += 1
                    setTimeout(queryCanvas, 40)
                    return
                  }

                  console.warn('[AnimatedIcon] CANVAS_NODE_MISSING', { canvasId, result })
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
                console.warn('[AnimatedIcon] CANVAS_QUERY_FAILED', { canvasId })
                resolve(null)
              }
            })
        } catch {
          console.warn('[AnimatedIcon] CANVAS_QUERY_THROWN', { canvasId })
          resolve(null)
        }
      })
    }

    queryCanvas()
  })
}
