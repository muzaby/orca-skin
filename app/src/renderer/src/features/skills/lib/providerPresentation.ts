import type {
  LocalizedProviderText,
  ProviderCatalogAttribution,
  ProviderCatalogIconName
} from '../../../../../shared/provider-catalog'
import type { ProviderInfo } from '../../../../../shared/ipc'
import type { IconName } from '../../../shared/ui/Icon'

const ICON_NAMES: Record<ProviderCatalogIconName, IconName> = {
  electrical_services: 'electricalServices',
  power_settings_new: 'power',
  link: 'link',
  description: 'doc',
  memory: 'cpu',
  language: 'globe'
}

export interface ProviderPresentation {
  readonly icon: IconName
  readonly title: string
  readonly body?: string
  readonly attribution?: ProviderCatalogAttribution
}

export function resolveLocalizedProviderText(text: LocalizedProviderText, locale: string): string {
  const exact = text[locale]
  if (exact) return exact
  const base = locale.split(/[-_]/, 1)[0]
  if (base && text[base]) return text[base]
  return text.ko || text.en
}

export function providerPresentation(provider: ProviderInfo, locale: string): ProviderPresentation {
  const catalog = provider.catalog
  if (!catalog) return { icon: 'power', title: provider.label }
  return {
    icon: ICON_NAMES[catalog.icon],
    title: catalog.title ? resolveLocalizedProviderText(catalog.title, locale) : provider.label,
    ...(catalog.body ? { body: resolveLocalizedProviderText(catalog.body, locale) } : {}),
    ...(catalog.attribution ? { attribution: catalog.attribution } : {})
  }
}
