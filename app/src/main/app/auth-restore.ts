// 부팅 시 connector 재연결 (0170) — 컴포지션 루트의 오케스트레이션.
//
// `bootstrap.ts` 안에 인라인으로 두지 않는 이유는 하나다: **electron 부팅 없이 테스트하기
// 위해서**. 여기는 순수 오케스트레이션이고 broker·PluginHost 는 구조적 포트로 받는다
// (0085 의 교훈 — "게이트 판정부를 electron 비의존 순수 모듈로 분리하는 seam 까지 지정했어야").
//
// 두 가지 불변식을 지킨다:
//   1. **부팅을 막지 않는다.** 사내망 밖이면 connector `start()` 가 타임아웃까지 간다.
//      실패는 전부 삼키고 로그로만 남긴다 — 앱이 안 뜨는 것보다 연결이 안 된 편이 낫다.
//   2. **실패한 binding 은 정리한다.** 서버가 PAT 를 폐기했으면 그 레코드를 남겨 둘 이유가
//      없다. logout 시켜 다음 화면에서 재입력을 받게 한다.

export interface RestoredConnection {
  bindingId: string
  connectorId: string
}

export interface RestoreConnectionsDeps {
  restored: readonly RestoredConnection[]
  connect: (input: { connectorId: string; bindingId: string }) => Promise<void>
  logout: (bindingId: string, cascade: boolean) => Promise<unknown>
  logger: (message: string, meta?: Record<string, unknown>) => void
}

export async function restoreConnections(deps: RestoreConnectionsDeps): Promise<void> {
  for (const entry of deps.restored) {
    try {
      await deps.connect({ connectorId: entry.connectorId, bindingId: entry.bindingId })
    } catch (error) {
      deps.logger('auth.restore.connect-failed', {
        connectorId: entry.connectorId,
        message: String(error)
      })
      // 연결이 안 되는 binding 을 남기면 UI 가 "연결됨" 으로 보이고 도구는 실패한다.
      try {
        await deps.logout(entry.bindingId, false)
      } catch (cleanupError) {
        // 정리마저 실패해도 다음 connector 는 계속 시도한다.
        deps.logger('auth.restore.cleanup-failed', {
          connectorId: entry.connectorId,
          message: String(cleanupError)
        })
      }
    }
  }
}
