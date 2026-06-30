export function basenameForDisplay(path: string | null | undefined, fallback = 'default'): string {
  const trimmed = path?.trim() ?? ''
  if (!trimmed) return fallback

  const normalized = trimmed.replace(/[\\/]+$/g, '')
  if (!normalized) return fallback

  const parts = normalized.split(/[\\/]+/)
  const base = parts.at(-1)?.trim()
  return base || fallback
}
