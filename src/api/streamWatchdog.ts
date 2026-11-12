/** Detect silent transports without aborting the request that owns execution. */
export function createStreamWatchdog(onTimeout: () => void, timeout = 45000) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    clearTimeout(timer)
    timer = undefined
  }
  const touch = () => {
    stop()
    timer = setTimeout(() => {
      timer = undefined
      onTimeout()
    }, timeout)
  }
  touch()
  return { touch, stop }
}
