import { createElement } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { renderComponent } from '@/test/render'

const device = vi.hoisted(() => ({ theme: 'light', storage: new Map<string, string>() }))
vi.mock('@tarojs/taro', () => ({
  default: {
    getAppBaseInfo: () => ({ theme: device.theme }),
    getStorageSync: (key: string) => device.storage.get(key),
    setStorageSync: (key: string, value: string) => device.storage.set(key, value),
  },
}))

import { setThemeMode, useDarkMode, useThemeMode } from './useDarkMode'

function Probe() {
  return createElement('span', null, useThemeMode() + ':' + useDarkMode())
}

beforeEach(() => {
  setThemeMode('system')
  device.theme = 'dark'
})

it('explicit appearance overrides the system and is saved; system mode follows the device', () => {
  expect(renderComponent(createElement(Probe))).toContain('system:true')
  setThemeMode('light')
  expect(device.storage.get('dinqor_theme')).toBe('light')
  expect(renderComponent(createElement(Probe))).toContain('light:false')
  device.theme = 'light'
  setThemeMode('dark')
  expect(renderComponent(createElement(Probe))).toContain('dark:true')
  setThemeMode('system')
  expect(renderComponent(createElement(Probe))).toContain('system:false')
})
