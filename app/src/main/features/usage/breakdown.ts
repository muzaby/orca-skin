// 배포가 제공한 기간 내역을 저장 전에 전부 검증한다. 미제공은 쓰기 후보를 만들지 않는다.
import type { UsageBreakdown, UsagePeriodKind, UsagePeriodMetrics } from '../../infra/db/types'
import type { UsageSnapshot } from './fetcher'
import { isRecord } from '../../../shared/obj'

export const USAGE_BREAKDOWN_LIMITS = {
  daily: 400,
  monthly: 120,
  modelsPerPeriod: 500,
  rows: 10_000
} as const

export class UsageBreakdownError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageBreakdownError'
  }
}

const metricKeys = [
  'inputTokens',
  'outputTokens',
  'cacheCreationInputTokens',
  'cacheReadInputTokens',
  'costUsd'
] as const

function object(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) throw new UsageBreakdownError(`Expected object: ${context}`)
  return value
}

function metrics(value: unknown, context: string): UsagePeriodMetrics | null {
  if (value == null) return null
  const input = object(value, context)
  let provided = false
  const result = {} as UsagePeriodMetrics
  for (const key of metricKeys) {
    const n = input[key]
    if (n == null) {
      result[key] = null
      continue
    }
    if (
      typeof n !== 'number' ||
      !Number.isFinite(n) ||
      n < 0 ||
      (key !== 'costUsd' && !Number.isSafeInteger(n))
    ) {
      throw new UsageBreakdownError(`Invalid ${context}.${key}`)
    }
    provided = true
    result[key] = n
  }
  return provided ? result : null
}

function periodKey(value: unknown, kind: UsagePeriodKind): string {
  if (typeof value !== 'string') throw new UsageBreakdownError(`Invalid ${kind} key`)
  if (kind === 'month') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
      throw new UsageBreakdownError(`Invalid month: ${value}`)
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new UsageBreakdownError(`Invalid day: ${value}`)
    const [y, m, d] = value.split('-').map(Number)
    // setFullYear avoids Date constructor's special treatment of years 00..99.
    const date = new Date(0)
    date.setFullYear(y, m - 1, d)
    date.setHours(0, 0, 0, 0)
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      throw new UsageBreakdownError(`Invalid day: ${value}`)
    }
  }
  return value
}

export function normalizeUsageBreakdown(snapshot: UsageSnapshot): UsageBreakdown {
  const result: UsageBreakdown = { totals: [], modelSets: [] }
  let rows = 0
  for (const [field, kind] of [
    ['daily', 'day'],
    ['monthly', 'month']
  ] as const) {
    const entries = snapshot[field]
    if (entries == null) continue
    if (!Array.isArray(entries) || entries.length > USAGE_BREAKDOWN_LIMITS[field]) {
      throw new UsageBreakdownError(`Invalid or oversized ${field}`)
    }
    const periods = new Set<string>()
    for (const entry of entries) {
      const item = object(entry, field)
      const period = periodKey(item[kind], kind)
      if (periods.has(period)) throw new UsageBreakdownError(`Duplicate ${kind}: ${period}`)
      periods.add(period)
      const total = metrics(item.total, `${period}.total`)
      if (total) {
        result.totals.push({ kind, period, ...total })
        rows++
      }
      if (item.models != null) {
        if (
          !Array.isArray(item.models) ||
          item.models.length > USAGE_BREAKDOWN_LIMITS.modelsPerPeriod
        ) {
          throw new UsageBreakdownError(`Invalid or oversized models: ${period}`)
        }
        const names = new Set<string>()
        const models: (UsagePeriodMetrics & { model: string })[] = []
        for (const value of item.models) {
          const modelInput = object(value, `${period}.models`)
          const model = typeof modelInput.model === 'string' ? modelInput.model.trim() : ''
          if (!model || model.length > 200 || names.has(model)) {
            throw new UsageBreakdownError(`Invalid or duplicate model: ${period}.${model}`)
          }
          names.add(model)
          const normalized = metrics(modelInput, `${period}.${model}`)
          if (normalized) {
            models.push({ model, ...normalized })
            rows++
          }
        }
        if (models.length > 0) result.modelSets.push({ kind, period, models })
      }
      if (rows > USAGE_BREAKDOWN_LIMITS.rows) throw new UsageBreakdownError('Too many usage rows')
    }
  }
  return result
}
