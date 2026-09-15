import type { ProviderInfo } from '../../../../../shared/ipc'
import type { IconName, PluginCatalogCopy } from '../../../../../shared/plugin-catalog'

export interface ResolvedPluginPresentation {
  icon: IconName
  title: string
  body: string | null
}

const normalizeLocale = (locale: string): string => locale.trim().replaceAll('_', '-').toLowerCase()

export function pluginPresentation(
  provider: ProviderInfo,
  locale: string
): ResolvedPluginPresentation {
  if (!provider.plugin) return { icon: 'power', title: provider.label, body: null }

  const entries = Object.entries(provider.plugin.copy)
  const byLocale = new Map<string, PluginCatalogCopy>()
  for (const [key, value] of entries) {
    const normalized = normalizeLocale(key)
    if (!byLocale.has(normalized)) byLocale.set(normalized, value)
  }
  const exact = normalizeLocale(locale)
  const base = exact.split('-')[0] ?? exact
  const selected =
    byLocale.get(exact) ??
    byLocale.get(base) ??
    byLocale.get('ko') ??
    byLocale.get('en') ??
    entries[0]?.[1]

  return {
    icon: provider.plugin.icon,
    title: selected?.title ?? provider.label,
    body: selected?.body ?? null
  }
}
