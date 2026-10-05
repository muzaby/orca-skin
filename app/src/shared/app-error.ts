/** Error report wire contract. Error objects and log metadata never cross this channel. */
export const APP_ERROR_TITLES = [
  'unexpected',
  'loadFailed',
  'saveFailed',
  'actionFailed',
  'copyFailed',
  'openFailed',
  'attachFailed',
  'sendFailed',
  'sessionOpenFailed',
  'bootStepDegraded',
  'legacyMigrationFailed',
  'mcpServerSkipped',
  'extensionsFailed',
  'authPersistenceUnavailable',
  'authDeclarationRejected',
  'scheduledJobFailed',
  'updaterUnavailable',
  'configInvalid',
  'eventDeliveryFailed',
  'engineInternal',
  'fileUnavailable'
] as const

export type AppErrorTitle = (typeof APP_ERROR_TITLES)[number]
export const APP_ERROR_DETAIL_MAX = 300
export const APP_ERROR_PENDING_MAX = 10

export type AppSettingsTab = 'general' | 'usage' | `provider:${string}`
export type AppErrorTarget =
  { kind: 'page'; path: `/${string}` } | { kind: 'settings'; tab: AppSettingsTab }

export interface AppErrorReport {
  id: string
  title: AppErrorTitle
  detail?: string
  origin: 'main' | 'renderer'
  target?: AppErrorTarget
}
