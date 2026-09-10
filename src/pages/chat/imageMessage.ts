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
