import type { StaticUsageProviderModule } from '../../../../../contracts/usage-report'

/**
 * Inactive template — the **subscription** variant (0176), for usage endpoints that
 * require authentication.
 *
 * The other two variants (`./index.ts` declarative config, `./provider-hook.ts` hand-written
 * hook) build their own request and read credentials from `ctx.secret`. Since the auth
 * platform (0157) owns credentials, that namespace has no writer anymore — an endpoint
 * behind ADFS/SSO, a PAT, or ID/password cannot be reached that way.
 *
 * Here the **usage connector** makes the authenticated call (declared in
 * `features/providers/declarations/service.ts` as a `kind:'service'` provider) and this module only
 * **maps its result**.
 * That is why `map` receives no `fetch` and no `secret`: raw credentials never reach usage
 * modules. The response format is entirely yours to interpret — the framework does not know it.
 */
export const exampleUsageSubscriptionModule: StaticUsageProviderModule = {
  adapter: 'claude',
  provider: 'example-subscribed',
  defaultSettings: {},
  usage: {
    subscription: {
      // `Provider.id`(kind:'service'). 생략하면 연결된 source **전부**의 표본을 받고
      // 아래 map 이 자기 것이 아닌 표본에 `null` 을 돌려주면 된다.
      sourceId: 'usage-corp',
      // origin 기준 상대 경로 + 파라미터(쿼리로 실린다). operation 레지스트리는 없다.
      request: { operation: 'quota', params: { scope: 'month' } },
      map: (sample, ctx) => {
        const payload = sample.payload as
          { quota?: { used_usd?: number; limit_usd?: number }; as_of?: string } | string
        // 형식이 다르면 **null** — 프레임워크가 마지막 성공 값을 stale 로 유지한다.
        if (typeof payload === 'string' || typeof payload.quota?.used_usd !== 'number') {
          ctx.logger('unexpected usage payload shape', { sourceId: sample.sourceId })
          return null
        }
        const usedUsd = payload.quota.used_usd
        const limitUsd = payload.quota.limit_usd ?? null
        const asOf = payload.as_of === undefined ? undefined : Date.parse(payload.as_of)
        return {
          providerKey: ctx.providerKey,
          fetchedAt: sample.fetchedAt,
          ...(asOf !== undefined && Number.isFinite(asOf) ? { asOf } : {}),
          source: 'external',
          scope: 'organization',
          quota: {
            usedUsd,
            limitUsd,
            remainingUsd: limitUsd === null ? null : Math.max(0, limitUsd - usedUsd)
          }
        }
      }
    }
  }
}
