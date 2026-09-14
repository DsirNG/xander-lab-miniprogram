import { useEffect, useRef } from 'react'

type PanelActiveOptions = {
  onShow?: () => void | Promise<void>
  onHide?: () => void
}

/** Maps a Panel's active flag to explicit enter/leave callbacks. */
export function usePanelActive(active: boolean, options: PanelActiveOptions = {}) {
  const wasActiveRef = useRef(false)
  const { onShow, onHide } = options

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      void onShow?.()
    } else if (!active && wasActiveRef.current) {
      onHide?.()
    }

    wasActiveRef.current = active
  }, [active, onHide, onShow])
}
