import { useEffect, useLayoutEffect } from 'react'
import {
  subscribeGeneratingSessions,
  subscribeResponseRequest,
  subscribeTurnEnd
} from '../../features/chat'
import { sessionsActions } from '../../features/sessions'

// chat의 정상 종료·응답 요청과 sessions의 표시 상태는 app에서만 연결한다.
export function subscribeSessionAttention(): () => void {
  const stopCompletion = subscribeTurnEnd(sessionsActions.markCompleted)
  const stopResponseRequest = subscribeResponseRequest(sessionsActions.markAwaitingResponse)
  const stopGenerating = subscribeGeneratingSessions(sessionsActions.setGeneratingSessions)
  return () => {
    stopCompletion()
    stopResponseRequest()
    stopGenerating()
  }
}

export function useSessionAttentionSubscription(): void {
  useEffect(subscribeSessionAttention, [])
}

// 메인 셸이 없으면 열람 세션도 없다. 구독 수명은 항상 마운트되는 RootGate가 소유한다.
export function useSessionCompletion(currentSessionId: string | null): void {
  useLayoutEffect(() => {
    sessionsActions.setViewedSession(currentSessionId)
    return () => sessionsActions.setViewedSession(null)
  }, [currentSessionId])
}
