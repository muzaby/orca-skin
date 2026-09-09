import { useEffect, useLayoutEffect } from 'react'
import { subscribeTurnEnd } from '../../features/chat'
import { sessionsActions } from '../../features/sessions'

// chat의 정상 종료와 sessions의 표시 상태는 app에서만 연결한다.
export function subscribeSessionCompletions(): () => void {
  return subscribeTurnEnd(sessionsActions.markCompleted)
}

export function useSessionCompletion(currentSessionId: string | null): void {
  useLayoutEffect(() => {
    sessionsActions.setViewedSession(currentSessionId)
    return () => sessionsActions.setViewedSession(null)
  }, [currentSessionId])
  useEffect(subscribeSessionCompletions, [])
}
