/**
 * 轻量 Markdown → HTML（供 Taro RichText 渲染，仅含微信 rich-text 支持的内联样式）
 * 支持：标题、段落、粗体/斜体/删除线/行内代码、代码块、链接、图片、有序/无序列表、引用、表格、分割线。
 */
const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const H1 = { 'font-size': '22px', 'font-weight': '700', color: '#111', margin: '0' }
const H2 = { 'font-size': '19px', 'font-weight': '700', color: '#111', margin: '0' }
const H3 = { 'font-size': '17px', 'font-weight': '700', color: '#111', margin: '0' }
const H4 = { 'font-size': '16px', 'font-weight': '700', color: '#111', margin: '0' }

const styleOf = (styles: Record<string, string>) =>
  Object.entries(styles)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')

const H_STYLE: Record<number, string> = {
  1: styleOf(H1),
  2: styleOf(H2),
  3: styleOf(H3),
  4: styleOf(H4),
  5: styleOf(H4),
  6: styleOf(H4),
}

const CODE_STYLE =
  'background:#f8f9fa;color:#c7254e;padding:1px 4px;border-radius:4px;font-size:90%;word-break:break-all;border:1px solid #f0f0f4'
const PARAGRAPH_STYLE = 'margin:0;line-height:1.7;font-size:15px;color:#333;word-break:break-word'
const BLOCKQUOTE_STYLE =
  'margin:0;padding:8px 12px;background:#ffffff;border-left:3px solid #1677ff;color:#555;line-height:1.7;font-size:14px;word-break:break-word;border-top:1px solid #f0f0f4;border-right:1px solid #f0f0f4;border-bottom:1px solid #f0f0f4;border-radius:0 8px 8px 0'
const PRE_STYLE =
  'background:#fafafa;color:#333;font-size:13px;line-height:1.6;padding:12px 14px;border-radius:10px;margin:0;overflow-x:auto;white-space:pre-wrap;word-break:break-all;border:1px solid #eeeeee'
const TABLE_STYLE =
  'width:100%;border-collapse:collapse;margin:0;font-size:13px;color:#333;table-layout:fixed'
const CELL_STYLE = 'border:1px solid #e0e0e8;padding:6px 10px;word-break:break-all'
const LI_STYLE = 'line-height:1.8;font-size:15px;color:#333;margin:4px 0'
const IMG_STYLE = 'max-width:100%;border-radius:8px;display:block;margin:0'
// RichText 节点内不能可靠继承页面 CSS 变量，使用与 --color-accent 一致的静态值。
const LINK_STYLE = 'color:#1677ff'
const HR_STYLE = 'margin:0;border-top:1px solid #ececf1'
const BLOCK_GAP = '<div style="height:10px"></div>'
const MATH_STYLE = 'font-family:serif;white-space:nowrap'

const MATH_SYMBOLS: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  phi: 'φ',
  omega: 'ω',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  cot: 'cot',
  sec: 'sec',
  csc: 'csc',
  circ: '°',
}

const SUPERSCRIPTS: Record<string, string> = {
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
}

const SUBSCRIPTS: Record<string, string> = {
  0: '₀',
  1: '₁',
  2: '₂',
  3: '₃',
  4: '₄',
  5: '₅',
  6: '₆',
  7: '₇',
  8: '₈',
  9: '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ',
}

const toScript = (value: string, table: Record<string, string>) =>
  [...value].map(char => table[char] ?? char).join('')

/** RichText 不支持 KaTeX DOM；将常见 TeX 转为原生富文本可显示的数学字符。 */
function renderMath(formula: string): string {
  let value = formula.trim()
  value = value.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
  value = value.replace(/\\frac\s*([^\s{}])\s*([^\s{}])/g, '($1)/($2)')
  value = value.replace(/\\([a-zA-Z]+)/g, (_, name: string) => MATH_SYMBOLS[name] ?? name)
  value = value.replace(/\^\{([^{}]*)\}/g, (_, exponent: string) =>
    toScript(exponent, SUPERSCRIPTS),
  )
  value = value.replace(/_\{([^{}]*)\}/g, (_, subscript: string) => toScript(subscript, SUBSCRIPTS))
  value = value.replace(/\^([^\s^_{}])/g, (_, exponent: string) => toScript(exponent, SUPERSCRIPTS))
  value = value.replace(/_([^\s^_{}])/g, (_, subscript: string) => toScript(subscript, SUBSCRIPTS))
  return `<span style="${MATH_STYLE}">${value}</span>`
}

/** 解析行内格式：返回转换后的 HTML 与剩余未处理文本 */
function parseInline(input: string): string {
  const tokens: string[] = []
  const stash = (part: string) => {
    tokens.push(part)
    return `\uE000${tokens.length - 1}\uE001`
  }

  let text = escapeHtml(input)
  // 先保护行内代码，防止其中的标记被二次解析
  text = text.replace(/`([^`]+)`/g, (_, code: string) =>
    stash(`<code style="${CODE_STYLE}">${code}</code>`),
  )
  // 兼容模型偶尔返回的 HTML 换行；仅放行 br，其他 HTML 仍保持转义。
  text = text.replace(/&lt;br\s*\/?&gt;/gi, '<br/>')
  // 标准 TeX 定界符及模型常输出的括号包裹形式。
  text = text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula: string) => renderMath(formula))
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula: string) => renderMath(formula))
    .replace(/\(([^()\n]*\\[a-zA-Z]+[^()\n]*)\)/g, (_, formula: string) => renderMath(formula))
    .replace(/\[([^\n]*\\[a-zA-Z]+[^\n]*)\]/g, (_, formula: string) => renderMath(formula))
  // 图片
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
    (_, alt: string, src: string) => `<img src="${src}" alt="${alt}" style="${IMG_STYLE}"/>`,
  )
  // 链接（保护 href 中的 &amp;）
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
    (_, label: string, href: string) => {
      const safeHref = href.replace(/&amp;/g, '&')
      return `<a href="${safeHref}" style="${LINK_STYLE}">${label}</a>`
    },
  )
  // 粗体 / 斜体 / 删除线
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
  // 恢复受保护的行内代码
  text = text.replace(/\uE000(\d+)\uE001/g, (_, index: string) => tokens[Number(index)])
  return text
}

const parseInlineBlock = (content: string): string => parseInline(content)

function renderRuns(
  lines: string[],
  index: number,
  ordered: boolean,
): { html: string; next: number } {
  const items: string[] = []
  let cursor = index
  const pattern = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/
  while (cursor < lines.length) {
    const match = lines[cursor].match(pattern)
    if (!match) break
    items.push(
      `<li style="${LI_STYLE}">${parseInlineBlock(lines[cursor].slice(match[0].length))}</li>`,
    )
    cursor += 1
  }
  const tag = ordered ? 'ol' : 'ul'
  return {
    html: `<${tag} style="margin:0;padding-left:20px">${items.join('')}</${tag}>`,
    next: cursor,
  }
}

function renderTable(lines: string[], index: number): { html: string; next: number } {
  const rows: string[][] = []
  let cursor = index
  const isSep = (line: string) => {
    const t = line.trim()
    return t.includes('-') && t.includes('|') && /^[\s|:-]+$/.test(t)
  }
  while (cursor < lines.length) {
    const line = lines[cursor].trim()
    if (!line.startsWith('|') && !line.includes('|')) break
    if (rows.length === 1 && isSep(line)) {
      cursor += 1
      continue
    }
    if (!line.includes('|')) break
    const cells = line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(cell => cell.trim())
    rows.push(cells)
    cursor += 1
  }
  const renderRow = (row: string[], isHead: boolean) =>
    `<tr>${row
      .map(
        cell =>
          `<td style="${CELL_STYLE}${isHead ? ';font-weight:700;background:#fafafc' : ''}">${parseInlineBlock(cell)}</td>`,
      )
      .join('')}</tr>`
  const body = rows.map((row, idx) => renderRow(row, idx === 0)).join('')
  return { html: `<table style="${TABLE_STYLE}">${body}</table>`, next: cursor }
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let cursor = 0

  while (cursor < lines.length) {
    const line = lines[cursor]
    const trimmed = line.trim()

    if (!trimmed) {
      cursor += 1
      continue
    }

    // 代码块
    const fence = trimmed.match(/^```(\S*)/)
    if (fence) {
      cursor += 1
      const codeLines: string[] = []
      while (cursor < lines.length && !lines[cursor].trim().startsWith('```')) {
        codeLines.push(escapeHtml(lines[cursor]))
        cursor += 1
      }
      cursor += 1
      blocks.push(
        `<div style="${PRE_STYLE}">${codeLines.map(l => (l ? l : '<br/>')).join('<br/>')}</div>`,
      )
      continue
    }

    // 标题
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      blocks.push(
        `<h${Math.min(level, 4)} style="${H_STYLE[Math.min(level, 4)]}">${parseInlineBlock(heading[2])}</h${Math.min(level, 4)}>`,
      )
      cursor += 1
      continue
    }

    // 分割线
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(trimmed)) {
      blocks.push(`<div style="${HR_STYLE}"></div>`)
      cursor += 1
      continue
    }

    // 列表
    if (/^\s*([-*+])\s+/.test(trimmed)) {
      const result = renderRuns(lines, cursor, false)
      blocks.push(result.html)
      cursor = result.next
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(trimmed)) {
      const result = renderRuns(lines, cursor, true)
      blocks.push(result.html)
      cursor = result.next
      continue
    }

    // 引用
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (cursor < lines.length && lines[cursor].trim().startsWith('>')) {
        quoteLines.push(parseInlineBlock(lines[cursor].trim().replace(/^>\s?/, '')))
        cursor += 1
      }
      blocks.push(
        `<blockquote style="${BLOCKQUOTE_STYLE}">${quoteLines.join('<br/>')}</blockquote>`,
      )
      continue
    }

    // 表格
    if (trimmed.includes('|')) {
      const result = renderTable(lines, cursor)
      if (result.next > cursor) {
        blocks.push(result.html)
        cursor = result.next
        continue
      }
    }

    // 段落：合并到空行或下一个块级结构
    const paragraphLines: string[] = []
    while (cursor < lines.length) {
      const current = lines[cursor]
      const currentTrimmed = current.trim()
      if (!currentTrimmed) break
      if (
        /^(#{1,6})\s+/.test(currentTrimmed) ||
        /^\s*([-*_])(\s*\1){2,}\s*$/.test(currentTrimmed) ||
        /^\s*([-*+])\s+/.test(currentTrimmed) ||
        /^\s*\d+[.)]\s+/.test(currentTrimmed) ||
        currentTrimmed.startsWith('>') ||
        currentTrimmed.startsWith('```') ||
        (currentTrimmed.includes('|') && lines[cursor + 1]?.includes('|'))
      ) {
        break
      }
      paragraphLines.push(current.trim())
      cursor += 1
    }
    if (paragraphLines.length) {
      blocks.push(
        `<p style="${PARAGRAPH_STYLE}">${parseInlineBlock(paragraphLines.join('<br/>'))}</p>`,
      )
      continue
    }
    cursor += 1
  }

  return `<div>${blocks.join(BLOCK_GAP)}</div>`
}

/** 思考过程摘要：取前若干字符作为卡片预览 */
export function truncate(text: string, max = 200): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}
