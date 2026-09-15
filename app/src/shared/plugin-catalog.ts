export const ICON_NAMES = [
  'todo',
  'terminal',
  'terminal2',
  'checklist',
  'chat',
  'plus',
  'search',
  'folder',
  'settings',
  'send',
  'cpu',
  'bolt',
  'cam',
  'board',
  'flask',
  'history',
  'user',
  'check',
  'x',
  'chevR',
  'chevD',
  'chevU',
  'panelL',
  'panelR',
  'expand',
  'collapse',
  'arrowNE',
  'download',
  'copy',
  'pause',
  'play',
  'capture',
  'link',
  'power',
  'refresh',
  'alert',
  'sparkle',
  'mic',
  'doc',
  'fileOpen',
  'trash',
  'layers',
  'kebab',
  'edit',
  'clock',
  'menu',
  'arrowL',
  'arrowR',
  'briefcase',
  'eye',
  'code',
  'upload',
  'pin',
  'stop',
  'enter',
  'fork',
  'sun',
  'moon',
  'globe',
  'chart',
  'commentAdd',
  'quote',
  'electricalServices'
] as const

export type IconName = (typeof ICON_NAMES)[number]

const ICON_NAME_SET: ReadonlySet<string> = new Set(ICON_NAMES)

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && ICON_NAME_SET.has(value)
}

export const DEFAULT_PLUGIN_ICON: IconName = 'electricalServices'

export interface PluginCatalogCopy {
  title: string
  body: string
}

export type PluginCatalogCopies = Readonly<Record<string, PluginCatalogCopy>>

export interface PluginCatalogPresentationInput {
  icon?: IconName
  copy?: PluginCatalogCopies
}

export interface PluginCatalogPresentation {
  icon: IconName
  copy: PluginCatalogCopies
}
