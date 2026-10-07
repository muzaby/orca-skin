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

/** Clamps a report detail to the wire limit; null/undefined become undefined. */
export function clampErrorDetail(detail: string | null | undefined): string | undefined {
  if (detail == null) return undefined
  return detail.length > APP_ERROR_DETAIL_MAX
    ? detail.slice(0, APP_ERROR_DETAIL_MAX - 1) + '…'
    : detail
}

/** Identity used by both the main-side throttle and the renderer toast dedupe. */
export function appErrorKey(report: Pick<AppErrorReport, 'title' | 'detail'>): string {
  return `${report.title}\0${report.detail ?? ''}`
}

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
