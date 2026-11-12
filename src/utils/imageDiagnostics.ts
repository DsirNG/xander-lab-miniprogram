export function logImageFailure(source: string, error: unknown) {
  const host = /^https?:\/\/([^/?#]+)/i.exec(source)?.[1]
  const message = typeof error === 'string' ? error : ''
  const reason = /domain|合法域名/i.test(message)
    ? 'domain'
    : /403|404|timeout|decode|permission/i.exec(message)?.[0]?.toLowerCase() ?? 'unknown'
  console.warn('[Image] Load failed', { source: host ?? 'local', reason })
}
