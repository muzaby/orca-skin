import type { ComposerCatalogFailure } from '../../shared/composer-catalog'

/** Retain only allowlisted diagnostics, never native messages, paths or response bodies. */
export class ComposerCatalogError extends Error {
  readonly failure: ComposerCatalogFailure
  constructor(stage: ComposerCatalogFailure['stage'], error: unknown) {
    super('OpenCode catalog read failed')
    const value = error && typeof error === 'object' ? (error as Record<string, unknown>) : {}
    const cause =
      value.cause && typeof value.cause === 'object' ? (value.cause as Record<string, unknown>) : {}
    const status = value.status ?? cause.status
    const httpStatus =
      typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
        ? status
        : undefined
    const code = value.code ?? cause.code
    this.failure = {
      stage,
      reason:
        value.name === 'TimeoutError'
          ? 'timeout'
          : value.name === 'AbortError'
            ? 'aborted'
            : httpStatus
              ? 'http'
              : ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].includes(String(code))
                ? 'network'
                : 'unavailable',
      ...(httpStatus ? { httpStatus } : {})
    }
  }
}
