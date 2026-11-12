import { createElement } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderComponent } from '@/test/render'

const captured = vi.hoisted(() => ({ textarea: {} as any, actions: new Map<string, () => void>(), classes: [] as string[] }))
vi.mock('@tarojs/components', () => ({
  Image: () => null,
  Text: ({ children }: any) => children,
  Textarea: (props: any) => {
    captured.textarea = props
    return null
  },
  View: ({ children, ariaLabel, onClick, className }: any) => {
    if (className) captured.classes.push(className)
    if (ariaLabel && onClick) captured.actions.set(ariaLabel, onClick)
    return children
  },
}))
vi.mock('@tarojs/taro', () => ({ default: { pxTransform: (value: number) => `${value}px` } }))
vi.mock('@/components/Icon', () => ({ Icon: () => null }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
import { ChatComposer, composerLineCount } from './ChatComposer'

const props = () => ({
  value: 'Draft',
  placeholder: 'Message',
  sendLabel: 'Send',
  stopLabel: 'Stop',
  running: false,
  creating: false,
  attachments: [],
  uploading: false,
  onChange: vi.fn(),
  onAddAttachment: vi.fn(),
  onRemoveAttachment: vi.fn(),
  onSubmit: vi.fn(),
  onStop: vi.fn(),
})
beforeEach(() => {
  captured.actions.clear()
  captured.classes = []
})

it('grows from one line to six lines and caps long or invalid measurements', () => {
  expect(composerLineCount(1)).toBe(1)
  expect(composerLineCount(3)).toBe(3)
  expect(composerLineCount(6)).toBe(6)
  expect(composerLineCount(100)).toBe(6)
  expect(composerLineCount(0)).toBe(1)
  expect(composerLineCount(NaN)).toBe(1)
})
it('lets WeChat size and reposition the textarea and keeps return separate from sending', () => {
  const onLayoutChange = vi.fn()
  const input = { ...props(), onLayoutChange }
  renderComponent(createElement(ChatComposer, input))
  expect(captured.textarea.autoHeight).toBeUndefined()
  expect(captured.textarea.adjustPosition).toBe(true)
  expect(captured.textarea.cursorSpacing).toBe(24)
  expect(captured.textarea.confirmType).toBe('return')
  expect(captured.textarea.onConfirm).toBeUndefined()
  expect(captured.textarea.style['--composer-lines']).toBe(1)
  expect(captured.textarea.onKeyboardHeightChange).toBeUndefined()
  captured.textarea.onLineChange({ detail: { lineCount: 2 } })
  expect(onLayoutChange).toHaveBeenCalled()
  captured.textarea.onInput({ detail: { value: 'First\nSecond' } })
  expect(input.onChange).toHaveBeenCalledWith('First\nSecond')
  captured.actions.get('Send')!()
  expect(input.onSubmit).toHaveBeenCalledExactlyOnceWith('First\nSecond')
})
it('stops an active response and blocks sending during uploads or creation', () => {
  for (const overrides of [{ running: true }, { uploading: true }, { creating: true }]) {
    const input = { ...props(), ...overrides }
    renderComponent(createElement(ChatComposer, input))
    captured.actions.get(input.running ? 'Stop' : 'Send')!()
    expect(input.onSubmit).not.toHaveBeenCalled()
    expect(input.onStop).toHaveBeenCalledTimes(input.running ? 1 : 0)
  }
})

it('opens multiline drafts with the native textarea and send control', () => {
  renderComponent(createElement(ChatComposer, { ...props(), value: 'First\nSecond' }))
  expect(captured.classes).toContain('chat-composer-field')
  expect(captured.textarea.value).toBe('First\nSecond')
  expect(captured.textarea.style['--composer-lines']).toBe(2)
  expect(captured.classes).toContain('chat-send-arrow')
})

it('keeps an empty draft in the single-line pill state', () => {
  renderComponent(createElement(ChatComposer, { ...props(), value: '' }))
  expect(captured.classes).toContain('chat-composer-field')
  expect(captured.classes).toContain('chat-composer-hint')
  expect(captured.textarea.placeholder).toBeUndefined()
  expect(captured.textarea.style['--composer-lines']).toBe(1)
})

it('ignores duplicate line measurements and empty placeholder wrapping', () => {
  const onLayoutChange = vi.fn()
  renderComponent(createElement(ChatComposer, { ...props(), value: '', onLayoutChange }))
  captured.textarea.onLineChange({ detail: { lineCount: 3 } })
  expect(onLayoutChange).not.toHaveBeenCalled()
  captured.textarea.onInput({ detail: { value: 'A long draft' } })
  captured.textarea.onLineChange({ detail: { lineCount: 2 } })
  captured.textarea.onLineChange({ detail: { lineCount: 2 } })
  expect(onLayoutChange).toHaveBeenCalledTimes(1)
})

it('disables caret-based repositioning on WeChat for both single and multiline drafts', () => {
  vi.stubEnv('TARO_ENV', 'weapp')
  try {
    for (const value of ['One line', 'First\nSecond']) {
      const onKeyboardHeightChange = vi.fn()
      renderComponent(createElement(ChatComposer, { ...props(), value, onKeyboardHeightChange }))
      expect(captured.textarea.adjustPosition).toBe(false)
      expect(captured.textarea.cursorSpacing).toBe(0)
      captured.textarea.onKeyboardHeightChange({ detail: { height: 280 } })
      expect(onKeyboardHeightChange).toHaveBeenCalledWith(280)
    }
  } finally {
    vi.unstubAllEnvs()
  }
})
