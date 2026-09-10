import { describe, expect, it } from 'vitest'
import type { AgentMessage } from '@/api/agent'
import { isImageTool, parseImageToolResult } from './imageMessage'

const toolResult = (toolName: string, content: string): AgentMessage => ({
  id: 1,
  conversationId: 2,
  role: 'tool',
  kind: 'tool_result',
  toolName,
  content,
  createdAt: '2026-09-10T00:00:00Z',
})

describe('image message tools', () => {
  it('recognizes image_resend as an image tool', () => {
    expect(isImageTool('image_resend')).toBe(true)
  })

  it('parses a persisted image_resend result for display', () => {
    const result = parseImageToolResult(
      toolResult(
        'image_resend',
        JSON.stringify({
          ok: true,
          tool: 'image_resend',
          url: '/api/publishing/media/42/content',
          title: 'existing.png',
        }),
      ),
      'https://api.example.com',
    )

    expect(result).toEqual({
      url: 'https://api.example.com/api/publishing/media/42/content',
      title: 'existing.png',
    })
  })
})
