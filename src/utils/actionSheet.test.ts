import { afterEach, expect, it } from 'vitest'
import { dismissActionSheet, getActionSheet, showThemedActionSheet } from './actionSheet'
afterEach(dismissActionSheet)
it('returns the selected option and closes the themed selector', async () => {
  const result = showThemedActionSheet({ itemList: ['Light', 'Dark'] })
  expect(getActionSheet()?.options.itemList).toEqual(['Light', 'Dark'])
  getActionSheet()!.finish(0)
  expect(await result).toEqual({ tapIndex: 0, errMsg: 'showActionSheet:ok' })
  expect(getActionSheet()).toBeNull()
})
it('dismiss and replacement reject old requests instead of selecting an option', async () => {
  const first = showThemedActionSheet({ itemList: ['Old'] }).catch(error => error)
  const second = showThemedActionSheet({ itemList: ['New'] }).catch(error => error)
  expect((await first).errMsg).toContain('cancel')
  dismissActionSheet()
  expect((await second).errMsg).toContain('cancel')
  expect(getActionSheet()).toBeNull()
})
