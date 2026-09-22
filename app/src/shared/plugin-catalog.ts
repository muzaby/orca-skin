// Provider catalog가 정본으로 승격된 뒤에도 기존 Plugin 배포 소스·외부 import를 보존한다.
export * from './provider-catalog'

import {
  DEFAULT_PROVIDER_CATALOG_ICON,
  PROVIDER_CATALOG_ICON_NAMES,
  normalizeProviderCatalogPresentation
} from './provider-catalog'
import type {
  LocalizedProviderText,
  ProviderCatalogAttribution,
  ProviderCatalogIconName,
  ProviderCatalogPresentation,
  ProviderCatalogPresentationInput
} from './provider-catalog'

export type PluginCatalogIconName = ProviderCatalogIconName
export const PLUGIN_CATALOG_ICON_NAMES = PROVIDER_CATALOG_ICON_NAMES
export const DEFAULT_PLUGIN_CATALOG_ICON = DEFAULT_PROVIDER_CATALOG_ICON
export type LocalizedPluginText = LocalizedProviderText
export type PluginCatalogAttribution = ProviderCatalogAttribution
export type PluginCatalogPresentation = ProviderCatalogPresentation
export type PluginCatalogPresentationInput = ProviderCatalogPresentationInput
export const normalizePluginCatalogPresentation = normalizeProviderCatalogPresentation
