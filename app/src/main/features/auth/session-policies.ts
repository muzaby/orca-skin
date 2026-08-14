// 선언 → 브라우저 세션 정책 (0182).
//
// ── 왜 이 파일이 생겼나 ──────────────────────────────────────────────────────
// 0181 은 `sessions.register()` 를 **로그인 실행부에서만** 불렀다(`specs/browser-session.ts` 의
// `SessionRunner.login`). 그래서 앱을 재시작하면:
//
//   쿠키   — 파티션(`persist:auth.<group>`)에 살아 있다
//   grant  — 파일에서 복원돼 `status()` 가 `valid` 다 (세션 grant 는 vault 를 읽지 않는다)
//   group  — **등록돼 있지 않다** ← 이것만 없다
//
// 그 상태에서 `ProviderApiImpl.transport()` 가 `sessions.acquire(group)` 을 부르면
// `Error('등록되지 않은 session group')` 가 던져진다. `ProviderPolicyError` 가 아니라 401 강등
// 경로도 타지 않아 **사용자에게 재인증 지점조차 뜨지 않는다**. 게다가 서비스 도구는 부팅 직후
// `status==='valid'` 를 보고 등록되므로, 모델에는 도구가 보이는데 부르면 죽는 형태가 된다.
//
// 그래서 **선언에서 정책을 뽑아 부팅 시 등록**한다. `register()` 는 파티션 핸들을 만들 뿐
// 네트워크도 창도 열지 않는다 — 부팅 비용이 사실상 없다.
//
// ── 왜 bootstrap 인라인이 아니라 별도 모듈인가 ──────────────────────────────
// `bootstrap.ts` 안에 루프를 넣으면 *부팅이 실제로 등록하는가* 를 확인할 방법이 사람 실기뿐이다.
// 포트(`register` 하나)를 인자로 받으면 fake 로 호출 인자를 단언할 수 있다 — `registry.ts` 의
// `registerProviders()` 가 같은 자리의 선례다.
//
// 레이어: features/auth → contracts·infra·shared (하향만).

import type { AuthDefinition } from '../../contracts/auth'
import { errorMessage } from '../../infra/errors'
import type { SessionGroupPolicy } from '../../infra/browser-session-policy'

// 정책 타입은 electron 비의존 순수 모듈이 갖는다 — 여기서 다시 적으면 필드를 늘려도 이 경로만
// 빠진다(0182 까지 실제로 `allowIntegratedAuthDomains` 가 그랬다).
export type { SessionGroupPolicy }

// `BrowserSessionStore` 가 구조적으로 만족하는 최소 포트. 전체를 받지 않는 이유는 이 모듈에
// 필요한 것이 등록 하나뿐이기 때문이다.
export interface SessionPolicySink {
  register(policy: SessionGroupPolicy): void
}

// 선언 배열에서 browser-session 정책만 뽑는다. **순수 함수** — 부작용도 electron 의존도 없다.
//
// 같은 `sessionGroup` 을 여러 Auth 가 선언하면 여기서 미리 합치지 않고 **정책을 그대로
// 여러 개 돌려준다** — 합집합 규칙은 `BrowserSessionStore.register()` 가 이미 갖고 있고,
// 두 곳에 두면 규칙이 갈린다(로그인 경로는 계속 store 의 합집합을 쓴다).
export function sessionPolicies(definitions: readonly AuthDefinition[]): SessionGroupPolicy[] {
  const out: SessionGroupPolicy[] = []
  for (const definition of definitions) {
    for (const spec of definition.methods) {
      if (spec.kind !== 'browser-session') continue
      out.push({
        sessionGroup: spec.config.sessionGroup,
        allowedOrigins: spec.config.allowedOrigins
      })
    }
  }
  return out
}

// 부팅 배선. **거부된 선언은 입력에 없어야 한다** — 호출부는 `registerProviders()` 를 통과한
// 목록(`registry.list()`)을 넘긴다. 형태가 어긋나 거부된 provider 의 cookie jar 를 만들어 두면
// 등록 검사가 막으려던 것이 뒷문으로 들어온다.
//
// **등록 실패가 부팅을 막지 않는다** — 여기서 던지면 앱이 아예 뜨지 않는다. 사유는 로그로 남기고
// 나머지 group 은 계속 등록한다(0181 의 persistence 폴백과 같은 태도).
export function registerDeclaredSessions(
  sink: SessionPolicySink,
  providers: readonly AuthDefinition[],
  logger?: (event: string, data: Record<string, unknown>) => void
): void {
  for (const policy of sessionPolicies(providers)) {
    try {
      sink.register(policy)
    } catch (error) {
      logger?.('providers.session.register.failed', {
        sessionGroup: policy.sessionGroup,
        reason: errorMessage(error)
      })
    }
  }
}
