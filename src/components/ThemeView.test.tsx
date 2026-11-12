import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderComponent } from '@/test/render'
const state = vi.hoisted(() => ({ dark: false, onShow: undefined as undefined | (() => void), setBackgroundColor: vi.fn().mockResolvedValue({}), setNavigationBarColor: vi.fn().mockResolvedValue({}), setBackgroundTextStyle: vi.fn().mockResolvedValue({}) }))
vi.mock('@/hooks/useDarkMode', () => ({ useDarkMode: () => state.dark }))
vi.mock('@tarojs/taro', () => ({ useDidHide: vi.fn(), useDidShow: (callback: () => void) => { state.onShow = callback }, default: state }))
vi.mock('@tarojs/components', () => ({ View: 'div', Text: 'span', Button: 'button', PageMeta: 'page-meta' }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
import { ThemeView } from './ThemeView'
import { getActionSheet, showThemedActionSheet } from '@/utils/actionSheet'
afterEach(() => { vi.unstubAllEnvs(); state.dark = false })
it('sets the native page background, overscroll areas and root view to the selected light appearance', () => {
  vi.stubEnv('TARO_ENV', 'weapp')
  const html = renderComponent(createElement(ThemeView, null, 'Content'))
  expect(html).not.toContain('page-meta')
  expect(html).toContain('theme-page-backdrop')
  expect(html).toContain('background-color:#ffffff')
  expect(html).toContain('theme-light')
  state.onShow!()
  expect(state.setBackgroundColor).toHaveBeenLastCalledWith({ backgroundColor: '#ffffff', backgroundColorTop: '#ffffff', backgroundColorBottom: '#ffffff' })
  expect(state.setNavigationBarColor).toHaveBeenLastCalledWith(expect.objectContaining({ frontColor: '#000000', backgroundColor: '#ffffff' }))
})
it('keeps the picker inside the resolved dark theme and returns its selection', async () => {
  vi.stubEnv('TARO_ENV', 'weapp'); state.dark = true
  const result = showThemedActionSheet({ itemList: ['System', 'Light', 'Dark'] })
  const html = renderComponent(createElement(ThemeView))
  expect(html).toContain('theme-dark')
  expect(html).toContain('background-color:#121214')
  expect(html).toContain('app-action-sheet-panel')
  expect(html).toContain('app-action-sheet-backdrop')
  expect(html).not.toContain('app-action-sheet-cancel')
  expect(html).toContain('Light')
  state.onShow!()
  expect(state.setNavigationBarColor).toHaveBeenLastCalledWith(expect.objectContaining({ frontColor: '#ffffff', backgroundColor: '#121214' }))
  expect(state.setBackgroundTextStyle).toHaveBeenLastCalledWith({ textStyle: 'light' })
  getActionSheet()!.finish(1)
  expect((await result).tapIndex).toBe(1)
})
