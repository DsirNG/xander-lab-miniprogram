import { afterEach, expect, it, vi } from 'vitest'
import { createStreamWatchdog } from './streamWatchdog'

afterEach(() => vi.useRealTimers())

it('recovers a silent stream once without waiting for request completion', () => {
  vi.useFakeTimers()
  const recover = vi.fn()
  createStreamWatchdog(recover)
  vi.advanceTimersByTime(45000)
  expect(recover).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(45000)
  expect(recover).toHaveBeenCalledTimes(1)
})

it('extends the deadline on activity and stops on detach or completion', () => {
  vi.useFakeTimers()
  const recover = vi.fn()
  const watchdog = createStreamWatchdog(recover)
  vi.advanceTimersByTime(40000)
  watchdog.touch()
  vi.advanceTimersByTime(40000)
  expect(recover).not.toHaveBeenCalled()
  watchdog.stop()
  vi.advanceTimersByTime(45000)
  expect(recover).not.toHaveBeenCalled()
})
