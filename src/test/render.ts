import { createRequire } from 'node:module'
import type { ReactElement } from 'react'

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup: (element: ReactElement) => string
}

/** Render hooks and lifecycle registration without a browser or WeChat runtime. */
export const renderComponent = renderToStaticMarkup
