import type { UsageReportConfig, ExternalUsageReport } from '../../shared/ipc'

export interface ExternalUsageContext {
  providerKey: string
  fetch: typeof fetch
  signal: AbortSignal
  secret: { get(name: string): string | null; set(name: string, value: string): void }
  env: Record<string, string>
  settings: Record<string, unknown>
  store: { get(key: string): unknown; set(key: string, value: unknown): void }
  logger: (message: string, meta?: Record<string, unknown>) => void
  clock: () => number
}

export interface ExternalUsageProvider {
  fetchUsageReport(ctx: ExternalUsageContext): Promise<ExternalUsageReport | null>
}

export interface StaticUsageProviderModule {
  adapter: 'claude'
  provider: string
  defaultSettings: Record<string, unknown>
  usage?: { config?: UsageReportConfig; provider?: ExternalUsageProvider }
}
