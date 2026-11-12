import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('keeps the selection capsule below navigation content across recursive component boundaries', () => {
  const css = readFileSync(new URL('./TabBar.scss', import.meta.url), 'utf8')
  const rule = (selector: string) => css.slice(css.indexOf(`${selector} {`)).split('}')[0]
  expect(rule('.tab-list')).toContain('z-index: 1;')
  expect(rule('.tab-list')).toContain('display: flex;')
  expect(rule('.pill-position')).toContain('z-index: -1;')
  expect(rule('.tab-item')).toContain('flex: 1 1 0%;')
  expect(rule('.tab-item')).toContain('width: 25%;')
  const nativeStyles = readFileSync(
    new URL('../native/chat-drawer/index.wxss', import.meta.url),
    'utf8',
  )
  expect(nativeStyles).not.toMatch(/\.pill-position\s*\{[^}]*z-index:\s*\d/)
})
