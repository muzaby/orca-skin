import { z } from 'zod'

/** Error report wire contract. Error objects and log metadata never cross this channel. */
export const APP_ERROR_TITLES = [
  'unexpected',
  'loadFailed',
  'saveFailed',
  'claudeSessionsCloseFailed',
  'actionFailed',
  'copyFailed',
  'openFailed',
  'attachFailed',
  'sendFailed',
  'sessionOpenFailed',
  'bootStepDegraded',
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

/** 프로세스 경계를 넘는 보고의 모양 — 받는 쪽이 이 스키마로 다시 본다 (0324 AC47). */
export const AppErrorReportSchema = z.object({
  id: z.string().min(1),
  title: z.enum(APP_ERROR_TITLES),
  detail: z.string().max(APP_ERROR_DETAIL_MAX).optional(),
  origin: z.enum(['main', 'renderer']),
  target: z
    .union([
      z.object({ kind: z.literal('page'), path: z.string().startsWith('/') }),
      z.object({ kind: z.literal('settings'), tab: z.string().min(1) })
    ])
    .optional()
})
