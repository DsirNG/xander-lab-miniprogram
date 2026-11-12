import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

const file = new URL('../native/chat-drawer/gesture.wxs', import.meta.url)

it('keeps the rounded cutout transparent and casts a shadow from visible content instead of the wrapper box', () => {
  const styles = readFileSync(new URL('../native/chat-drawer/index.wxss', import.meta.url), 'utf8')
  const foreground = styles.match(/\.native-drawer-foreground\s*\{([^}]+)\}/)?.[1]
  expect(foreground).toContain('background:transparent;')
  expect(foreground).toContain('box-shadow:none;')
  expect(foreground).toContain('filter:drop-shadow(-24px 0 24px rgba(0,0,0,.18));')
  expect(foreground).toContain('overflow:hidden;')
  const chatStyles = readFileSync(new URL('../features/chat/ChatContent.scss', import.meta.url), 'utf8')
  const content = chatStyles.match(/\.chat-page\.chat-page--native-drawer \.chat-main-shell\s*\{([^}]+)\}/)?.[1]
  expect(content).toContain('border-top-left-radius: var(--chat-shell-top-radius, 54px);')
  expect(content).toContain('border-bottom-left-radius: var(--chat-shell-top-radius, 54px);')
})

it('paints a full-size backdrop independently of the scaled sidebar content', () => {
  const styles = readFileSync(new URL('../native/chat-drawer/index.wxss', import.meta.url), 'utf8')
  const host = styles.match(/\.native-drawer-host\s*\{([^}]+)\}/)?.[1]
  expect(host).toContain('width:100%')
  expect(host).toContain('height:100%')
  expect(host).toContain('background:var(--chat-surface,var(--color-surface,#ffffff))')
  const s = setup(true)
  const sidebar = s.positions.find(position => position.selector === '.native-drawer-sidebar')?.style
  expect(sidebar).not.toHaveProperty('border-radius')
})

function setup(open = false) {
  const module = { exports: {} as any }
  runInNewContext(readFileSync(file, 'utf8'), { module })
  const positions: Array<{ selector: string; style: Record<string, string> }> = []
  const calls: Array<{ method: string; data: any }> = []
  const state: Record<string, any> = {}
  const owner = {
    getState: () => state,
    selectComponent: (selector: string) => ({
      setStyle: (style: Record<string, string>) => {
        // WXS consumes CSS property names, unlike React's style object.
        for (const property of Object.keys(style)) expect(property).not.toMatch(/[A-Z]/)
        positions.push({ selector, style })
      },
    }),
    callMethod: (method: string, data: any) => calls.push({ method, data }),
  }
  module.exports.configure({ width: 280, enabled: true, open }, null, owner)
  return { api: module.exports, positions, calls, state, owner }
}
const event = (x: number, y: number, timeStamp: number) => ({ touches: [{ clientX: x, clientY: y }], timeStamp })

it('starts square, rounds during movement and becomes square again after closing', () => {
  const s = setup()
  const foreground = () => s.positions.filter(position => position.selector === '.native-drawer-foreground').slice(-1)[0].style
  expect(foreground()['border-top-left-radius']).toBe('0px')
  expect(foreground()['border-bottom-left-radius']).toBe('0px')
  s.api.start(event(0, 0, 0), s.owner)
  s.api.move(event(20, 0, 100), s.owner)
  expect(foreground()['border-top-left-radius']).toBe('20px')
  s.api.move(event(100, 0, 200), s.owner)
  expect(foreground()['border-top-left-radius']).toBe('54px')
  s.api.cancel(event(100, 0, 300), s.owner)
  expect(foreground()['border-top-left-radius']).toBe('0px')
  expect(foreground()['border-bottom-left-radius']).toBe('0px')
  expect(foreground().transition).toContain('border-top-left-radius 240ms')
  const open = setup(true)
  expect(open.positions.find(position => position.selector === '.native-drawer-foreground')?.style['border-top-left-radius']).toBe('54px')
})

it('moves only the foreground in the view layer and sends no per-frame JS messages', () => {
  const s = setup()
  s.api.start(event(0, 0, 0), s.owner)
  s.api.move(event(100, 1, 200), s.owner)
  s.api.move(event(180, 1, 400), s.owner)
  const foregroundMove = s.positions.filter((item: { selector: string; style: Record<string, string> }) => item.selector === '.native-drawer-foreground').slice(-1)[0]?.style
  expect(foregroundMove.transform).toBe('translate3d(180px,0,0)')
  expect(foregroundMove.transition).toBe('none')
  expect(s.calls.map(call => call.method)).toEqual(['gestureStart'])
  s.api.end(event(180, 1, 550), s.owner)
  expect(s.calls[s.calls.length - 1]).toEqual({ method: 'gestureEnd', data: { open: true } })
  const foregroundPositions = s.positions.filter((position: { selector: string; style: Record<string, string> }) => position.selector === '.native-drawer-foreground')
  expect(foregroundPositions[foregroundPositions.length - 1]?.style.transform).toBe('translate3d(280px,0,0)')
  expect(foregroundPositions[foregroundPositions.length - 1]?.style.transition).toContain('240ms')
  expect(s.positions.some(position => position.selector === '.native-drawer-edge-shadow')).toBe(true)
  expect(s.positions.some(position => position.selector === '.native-drawer-sidebar')).toBe(true)
})

it('does not snap to the endpoint when JS reveals the sidebar during a drag', () => {
  const s = setup()
  s.api.start(event(0, 0, 0), s.owner)
  s.api.move(event(80, 0, 100), s.owner)
  const count = s.positions.length
  s.api.configure({ width: 280, open: true, enabled: true }, null, s.owner)
  expect(s.positions.length).toBe(count)
  s.api.cancel(event(80, 0, 200), s.owner)
  expect(s.calls[s.calls.length - 1]?.data.open).toBe(false)
})

it('leaves vertical scrolling alone, clamps horizontal travel and settles closing without a middle step', () => {
  const vertical = setup()
  vertical.api.start(event(0, 0, 0), vertical.owner)
  vertical.api.move(event(5, 60, 50), vertical.owner)
  expect(vertical.calls).toHaveLength(0)

  const open = setup(true)
  open.api.start(event(250, 0, 0), open.owner)
  open.api.move(event(-100, 0, 100), open.owner)
  expect(open.state.x).toBe(0)
  const count = open.positions.length
  open.api.end(event(-100, 0, 110), open.owner)
  expect(open.positions.length).toBeGreaterThan(count)
  expect(open.calls[open.calls.length - 1]?.data.open).toBe(false)
})

it('initializes the bound foreground even before selector lookup is available', () => {
  const s = setup()
  const painted: Record<string, string>[] = []
  s.owner.selectComponent = () => null as any
  const surface = { setStyle: (style: Record<string, string>) => painted.push(style) }
  s.api.configure({ width: 280, enabled: true, open: false }, null, s.owner, surface)
  s.api.start(event(0, 0, 0), s.owner)
  s.api.move(event(90, 0, 100), s.owner)
  expect(painted[painted.length - 1].transform).toBe('translate3d(90px,0,0)')
})
