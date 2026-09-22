export const PROVIDER_CATALOG_ICON_NAMES = [
  'electrical_services',
  'power_settings_new',
  'link',
  'description',
  'memory',
  'language'
] as const

export type ProviderCatalogIconName = (typeof PROVIDER_CATALOG_ICON_NAMES)[number]

export const DEFAULT_PROVIDER_CATALOG_ICON: ProviderCatalogIconName = 'electrical_services'

export type LocalizedProviderText = Readonly<{
  ko: string
  en: string
  [locale: string]: string
}>

export interface ProviderCatalogAttribution {
  readonly source: string
  readonly version: string
  readonly githubUrl: string
  readonly license?: string
}

export interface ProviderCatalogPresentation {
  readonly icon: ProviderCatalogIconName
  readonly title?: LocalizedProviderText
  readonly body?: LocalizedProviderText
  readonly attribution?: ProviderCatalogAttribution
}

export type ProviderCatalogPresentationInput = Omit<ProviderCatalogPresentation, 'icon'> & {
  readonly icon?: ProviderCatalogIconName
}

const ICON_NAMES = new Set<string>(PROVIDER_CATALOG_ICON_NAMES)

function assertText(name: 'title' | 'body', text: LocalizedProviderText | undefined): void {
  if (!text) return
  for (const locale of ['ko', 'en'] as const) {
    if (typeof text[locale] !== 'string' || text[locale].trim().length === 0) {
      throw new Error(`provider catalog ${name}.${locale} must be a non-empty string`)
    }
  }
  for (const [locale, value] of Object.entries(text)) {
    if (locale.trim().length === 0 || typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`provider catalog ${name}.${locale || '<empty>'} must be a non-empty string`)
    }
  }
}

export function normalizeProviderCatalogPresentation(
  input: ProviderCatalogPresentationInput = {}
): ProviderCatalogPresentation {
  const icon = input.icon ?? DEFAULT_PROVIDER_CATALOG_ICON
  if (!ICON_NAMES.has(icon)) throw new Error(`provider catalog icon is not supported: ${icon}`)
  assertText('title', input.title)
  assertText('body', input.body)
  return {
    icon,
    ...(input.title ? { title: { ...input.title } } : {}),
    ...(input.body ? { body: { ...input.body } } : {}),
    ...(input.attribution ? { attribution: { ...input.attribution } } : {})
  }
}
