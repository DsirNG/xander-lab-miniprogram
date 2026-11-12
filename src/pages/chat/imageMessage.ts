import type { AgentMessage } from '@/api/agent'

export type ImageToolResult = {
  url: string
  title?: string
}

export const IMAGE_TOOL = 'image_generate'
export const IMAGE_RESEND_TOOL = 'image_resend'
export const IMAGE_TOOL_NAMES = new Set([IMAGE_TOOL, IMAGE_RESEND_TOOL])

export function isImageTool(tool: string | null | undefined) {
  return Boolean(tool && IMAGE_TOOL_NAMES.has(tool))
}

export function absoluteMediaUrl(url: string, apiOrigin: string) {
  if (/^https?:\/\//i.test(url)) return url
  return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`
}

export function parseImageToolResult(
  message: AgentMessage,
  apiOrigin: string,
): ImageToolResult | null {
  if (message.kind !== 'tool_result') return null

  try {
    const payload = JSON.parse(message.content) as {
      tool?: unknown
      url?: unknown
      title?: unknown
    }
    const tool = typeof payload.tool === 'string' ? payload.tool : message.toolName
    if (!isImageTool(tool) || typeof payload.url !== 'string' || !payload.url) return null
    return {
      url: absoluteMediaUrl(payload.url, apiOrigin),
      ...(typeof payload.title === 'string' ? { title: payload.title } : {}),
    }
  } catch {
    return null
  }
}

export type ImageMessagePart =
  | { type: 'text'; content: string }
  | { type: 'image'; url: string; title: string }

/** Pull image answers out of RichText so signed URLs stay intact and can be previewed. */
export function splitImageAnswer(content: string): ImageMessagePart[] {
  const parts: ImageMessagePart[] = []
  const pattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g
  let end = 0
  for (const match of content.matchAll(pattern)) {
    const start = match.index!
    if (start > end) parts.push({ type: 'text', content: content.slice(end, start) })
    parts.push({ type: 'image', title: match[1], url: match[2].replace(/&amp;/g, '&') })
    end = start + match[0].length
  }
  if (end < content.length) parts.push({ type: 'text', content: content.slice(end) })
  return parts
}

export function sameImageResource(first: string, second: string) {
  const resource = (url: string) => url.split(/[?#]/, 1)[0]
  return resource(first) === resource(second)
}
