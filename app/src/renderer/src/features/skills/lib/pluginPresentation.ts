import type {
  LocalizedPluginText,
  PluginCatalogIconName,
  PluginCatalogAttribution
} from '../../../../../shared/plugin-catalog'
import type { ProviderInfo } from '../../../../../shared/ipc'
import type { IconName } from '../../../shared/ui/Icon'

const ICON_NAMES: Record<PluginCatalogIconName, IconName> = {
  electrical_services: 'electricalServices',
  power_settings_new: 'power',
  link: 'link',
  description: 'doc',
  memory: 'cpu',
  language: 'globe'
}

export interface PluginPresentation {
  readonly icon: IconName
  readonly title: string
  readonly body?: string
  readonly attribution?: PluginCatalogAttribution
}

export function resolveLocalizedPluginText(text: LocalizedPluginText, locale: string): string {
  const exact = text[locale]
  if (exact) return exact
  const base = locale.split(/[-_]/, 1)[0]
  if (base && text[base]) return text[base]
  return text.ko || text.en
}

export function pluginPresentation(provider: ProviderInfo, locale: string): PluginPresentation {
  const catalog = provider.catalog
  if (!catalog) return { icon: 'power', title: provider.label }
  return {
    icon: ICON_NAMES[catalog.icon],
    title: catalog.title ? resolveLocalizedPluginText(catalog.title, locale) : provider.label,
    ...(catalog.body ? { body: resolveLocalizedPluginText(catalog.body, locale) } : {}),
    ...(catalog.attribution ? { attribution: catalog.attribution } : {})
  }
}
