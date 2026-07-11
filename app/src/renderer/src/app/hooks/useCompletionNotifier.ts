import { useEffect, useRef } from 'react'
import { useChatSession } from '../../features/chat'
import { useTweakContext } from '../../shared/theme'
import { useI18n } from '../../shared/i18n'
import { notifyApi } from '../../shared/api/ipc'

// 응답완료 알림 트리거(app 레이어). 활성 세션의 inflight 가 **같은 세션에서 true→false**
// 로 전이하면 턴 완료로 보고 OS 알림을 요청한다. 세션 전환에 의한 flip(다른 세션으로
// 이동해 inflight 가 바뀌는 경우)은 sessionId 비교로 제외한다. "창 비활성일 때만" 게이트는
// main(notifyShow 핸들러)이 담당하므로 여기서는 토글(notifyOnComplete)만 확인한다.
export function useCompletionNotifier(): void {
  const { t } = useTweakContext()
  const { tr } = useI18n()
  const inflight = useChatSession((s) => s.inflight)
  const sessionId = useChatSession((s) => s.sessionId)
  const prev = useRef<{ sessionId: string | null; inflight: boolean }>({ sessionId, inflight })

  useEffect(() => {
    const before = prev.current
    prev.current = { sessionId, inflight }
    if (before.sessionId === sessionId && before.inflight && !inflight && t.notifyOnComplete) {
      void notifyApi.show({ title: 'Orca', body: tr('notify.completeBody') })
    }
  }, [inflight, sessionId, t.notifyOnComplete, tr])
}
