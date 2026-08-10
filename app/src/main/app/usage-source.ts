// `UsageSourcePort` 어댑터 (0176 → 0181 복원) — provider 플랫폼을 사용량 구독 경로에 잇는다.
//
// **컴포지션 루트에 사는 이유**: `features/usage` 는 `features/providers` 를 직접 import 할 수
// 없다(feature 수직 슬라이스 교차 금지). 포트는 `contracts/usage-source.ts` 가 선언하고,
// 여기서 concrete 를 만들어 주입한다 — `src/main/AGENTS.md` §해소책 1+3.
//
// 0181 변경점: 구 구현은 `PluginHost` 의 connection lifecycle 을 봤다. 지금은 **`Provider` 선언과
// grant 상태**가 그 자리를 대신한다 — `connected` = grant 가 valid 인가.

import type {
  UsageSampleOutcome,
  UsageSampleRequest,
  UsageSourceInfo,
  UsageSourcePort
} from '../contracts/usage-source'
import type { Provider, ProviderApi } from '../contracts/provider'
import type { ProviderGrantStatus } from '../../shared/ipc'

export interface UsageSourceDeps {
  // 사용량 표본을 낼 수 있는 provider 들(현재는 `kind:'service'`).
  providers: () => readonly Provider[]
  status: (providerId: string) => ProviderGrantStatus
  api: Pick<ProviderApi, 'request'>
}

// operation 이름 = origin 기준 상대 경로. 사용량 API 는 GET 한 번이면 끝나므로 별도의
// operation 레지스트리를 만들지 않는다 — 만들면 배포가 두 곳(선언·레지스트리)을 맞춰야 한다.
export function createUsageSourcePort(deps: UsageSourceDeps): UsageSourcePort {
  return {
    list(): readonly UsageSourceInfo[] {
      return deps.providers().map((provider) => ({
        sourceId: provider.id,
        label: provider.label,
        connected: deps.status(provider.id) === 'valid'
      }))
    },

    async invoke(
      sourceId: string,
      request: UsageSampleRequest,
      signal?: AbortSignal
    ): Promise<UsageSampleOutcome> {
      const provider = deps.providers().find((candidate) => candidate.id === sourceId)
      if (!provider) {
        return { ok: false, sourceId, operation: request.operation, reason: 'unknown_source' }
      }
      // 미인증은 **정상 상태다** — 부팅 직후·사내망 밖·로그아웃 후. 오류로 올리지 않는다.
      if (deps.status(sourceId) !== 'valid') {
        return { ok: false, sourceId, operation: request.operation, reason: 'not_connected' }
      }

      try {
        const res = await deps.api.request(
          sourceId,
          {
            path: request.operation,
            method: 'GET',
            headers: { accept: 'application/json' },
            ...(request.params ? { query: toQuery(request.params) } : {})
          },
          signal
        )
        if (!res.ok) {
          return {
            ok: false,
            sourceId,
            operation: request.operation,
            reason: 'invoke_failed',
            message: `status ${res.status}`
          }
        }
        return {
          ok: true,
          sample: {
            sourceId,
            operation: request.operation,
            fetchedAt: Date.now(),
            status: res.status,
            ...(res.headers['content-type'] !== undefined
              ? { contentType: res.headers['content-type'] }
              : {}),
            // **해석은 구독자 몫이다.** JSON 이면 파싱해 주고 아니면 원문을 그대로 넘긴다.
            payload: parseMaybeJson(res.body)
          }
        }
      } catch (error) {
        return {
          ok: false,
          sourceId,
          operation: request.operation,
          reason: 'invoke_failed',
          message: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

function toQuery(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) out[name] = String(value)
  }
  return out
}

function parseMaybeJson(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}
