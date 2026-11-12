const tiers = ['FREE', 'PLUS', 'PRO', 'ULTRA']

export function activeTier(tier?: string, expiresAt?: string | null, now = Date.now()) {
  if (!tier || !tiers.includes(tier)) return 'FREE'
  if (!expiresAt) return tier
  const raw = expiresAt.trim().replace(' ', 'T')
  const expiry = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`)
  return Number.isFinite(expiry) && expiry > now ? tier : 'FREE'
}

export function canBuyTier(current: string, target: string) {
  return tiers.indexOf(target) > Math.max(0, tiers.indexOf(current))
}
