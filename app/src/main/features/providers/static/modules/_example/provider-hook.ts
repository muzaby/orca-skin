import type {
  ExternalUsageProvider,
  StaticUsageProviderModule
} from '../../../../../contracts/usage-report'

/**
 * Inactive template — the hand-written `usage.provider` hook variant (0130).
 *
 * `./index.ts` shows the declarative `usage.config` path (single HTTP call +
 * JSON path mapping). Companies whose usage endpoint needs auth handshakes,
 * pagination, or response reshaping should implement the hook instead: the
 * framework calls `fetchUsageReport(ctx)` and only consumes
 * `ExternalUsageReport | null` — everything inside is module-owned.
 * Typechecked but not exported from `../index.ts`; copy, adapt, then register.
 */
const exampleUsageHook: ExternalUsageProvider = {
  async fetchUsageReport(ctx) {
    // SSO 모듈이 providerSecrets 로 공유한 토큰(0130 핸드셰이크) — 없으면 이번 주기는 건너뛴다.
    const token = ctx.secret.get('usage-report-token')
    if (!token) {
      ctx.logger('usage token not yet provisioned — skipping fetch')
      return null
    }

    // 페이지네이션 예시 — 프레임워크 타임아웃(ctx.signal)을 모든 요청에 전파한다.
    let usedUsd = 0
    let cursor: string | null = null
    do {
      const url = new URL('https://usage.example.invalid/v2/report')
      if (cursor) url.searchParams.set('cursor', cursor)
      const res = await ctx.fetch(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: ctx.signal
      })
      if (res.status === 401) {
        // 재인증은 모듈 소유 — 만료 사실만 기록하고 SSO 재로그인(토큰 덮어쓰기)에 맡긴다.
        ctx.store.set('tokenRejectedAt', ctx.clock())
        return null
      }
      if (!res.ok) throw new Error(`usage endpoint ${res.status}`)
      const page = (await res.json()) as { items: Array<{ costUsd: number }>; next: string | null }
      usedUsd += page.items.reduce((sum, item) => sum + item.costUsd, 0)
      cursor = page.next
    } while (cursor)

    return {
      providerKey: ctx.providerKey,
      fetchedAt: ctx.clock(),
      source: 'external',
      scope: 'organization',
      quota: { usedUsd, limitUsd: 1000, remainingUsd: Math.max(0, 1000 - usedUsd) }
    }
  }
}

export const exampleUsageHookModule: StaticUsageProviderModule = {
  adapter: 'claude',
  provider: 'example-inhouse',
  defaultSettings: {},
  usage: { provider: exampleUsageHook }
}
