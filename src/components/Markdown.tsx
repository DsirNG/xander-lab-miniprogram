import { RichText } from '@tarojs/components'
import { useMemo } from 'react'
import { markdownToHtml } from '@/utils/markdown'

export function Markdown({ content, className = '' }: { content: string; className?: string }) {
  const html = useMemo(() => markdownToHtml(content), [content])
  return <RichText className={className} nodes={html} />
}
