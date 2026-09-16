export const PLUGIN_CATALOG_ICON_NAMES = [
  'electrical_services',
  'power_settings_new',
  'link',
  'description',
  'memory',
  'language'
] as const

export type PluginCatalogIconName = (typeof PLUGIN_CATALOG_ICON_NAMES)[number]

export const DEFAULT_PLUGIN_CATALOG_ICON: PluginCatalogIconName = 'electrical_services'

export type LocalizedPluginText = Readonly<{
  ko: string
  en: string
  [locale: string]: string
}>

export interface PluginCatalogAttribution {
  readonly source: string
  readonly version: string
  readonly githubUrl: string
  readonly license?: string
}

export interface PluginCatalogPresentation {
  readonly icon: PluginCatalogIconName
  readonly title?: LocalizedPluginText
  readonly body?: LocalizedPluginText
  readonly attribution?: PluginCatalogAttribution
}

export type PluginCatalogPresentationInput = Omit<PluginCatalogPresentation, 'icon'> & {
  readonly icon?: PluginCatalogIconName
}

const ICON_NAMES = new Set<string>(PLUGIN_CATALOG_ICON_NAMES)

function assertText(name: 'title' | 'body', text: LocalizedPluginText | undefined): void {
  if (!text) return
  for (const locale of ['ko', 'en'] as const) {
    if (typeof text[locale] !== 'string' || text[locale].trim().length === 0) {
      throw new Error(`plugin catalog ${name}.${locale} must be a non-empty string`)
    }
  }
  for (const [locale, value] of Object.entries(text)) {
    if (locale.trim().length === 0 || typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`plugin catalog ${name}.${locale || '<empty>'} must be a non-empty string`)
    }
  }
}

export function normalizePluginCatalogPresentation(
  input: PluginCatalogPresentationInput = {}
): PluginCatalogPresentation {
  const icon = input.icon ?? DEFAULT_PLUGIN_CATALOG_ICON
  if (!ICON_NAMES.has(icon)) throw new Error(`plugin catalog icon is not supported: ${icon}`)
  assertText('title', input.title)
  assertText('body', input.body)
  return {
    icon,
    ...(input.title ? { title: { ...input.title } } : {}),
    ...(input.body ? { body: { ...input.body } } : {}),
    ...(input.attribution ? { attribution: { ...input.attribution } } : {})
  }
}
