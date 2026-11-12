import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './markdown'

describe('markdownToHtml', () => {
  it('renders standard and model-style TeX without exposing TeX commands', () => {
    const html = markdownToHtml(
      [
        '特殊角求值 (\\sin30^\\circ=\\frac12)',
        '',
        '[ \\sin30^\\circ+\\cos60^\\circ=1 ]',
        '',
        '\\(\\tan\\alpha=\\frac34\\)',
        '',
        '\\[\\sin^2\\alpha+\\cos^2\\alpha=1\\]',
      ].join('\n'),
    )

    expect(html).toContain('sin30')
    expect(html).toContain('tanα=(3)/(4)')
    expect(html).toContain('sin²α+cos²α=1')
    expect(html).not.toContain('\\frac')
    expect(html).not.toContain('\\alpha')
  })
})

it('uses readable dark rich-text styles without recoloring literal article content', () => {
  const source = '# Heading\n\nText #18181b and `sample`\n\n> Quote\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'
  const html = markdownToHtml(source, true)
  expect(html).toContain('color:#f4f4f5')
  expect(html).toContain('color:#e4e4e7')
  expect(html).toContain('background:#25252a')
  expect(html).toContain('background:#1e1e22')
  expect(html).toContain('background:#28282e')
  expect(html).toContain('Text #18181b')
  expect(markdownToHtml(source)).toContain('color:#27272a')
})
