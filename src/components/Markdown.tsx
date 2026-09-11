import { RichText } from '@tarojs/components'
import { memo, useMemo } from 'react'
import { markdownToHtml } from '@/utils/markdown'

/**
 * Markdown 渲染。
 *
 * <p>memo 在这里很重要：解析整段 Markdown 是聊天页最贵的一次计算，
 * 而流式场景下父组件会按时间窗反复重渲染。包住之后，
 * content 未变的历史消息不会重新触发 {@link markdownToHtml}——
 * 它的 useMemo 因此才真正只对"内容变了的那一条"生效。</p>
 */
export const Markdown = memo(function Markdown({
  content,
  className = '',
}: {
  content: string
  className?: string
}) {
  const html = useMemo(() => markdownToHtml(content), [content])
  return <RichText className={className} nodes={html} />
})
