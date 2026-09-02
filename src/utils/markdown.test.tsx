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
