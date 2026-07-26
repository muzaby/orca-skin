import { useEffect, useRef } from 'react'
import { useChatBusy, useChatRecentsEpoch } from '../../features/chat'
import { sessionsActions } from '../../features/sessions'

// 채팅 턴 완료 (busy: true → false 전이) 시 사이드바 세션 목록을 자동 갱신.
// cross-feature effect 라 셸이 호스트한다 (features/ 끼리는 직접 결합 못함).
// 0149 — listen 대기도 busy 로 센다: 대기 중 알림 턴이 inflight 만 내리는 순간에 조기 refresh
// 하고 정작 백그라운드 완료 후에는 갱신하지 않던 어긋남을 없앤다(useChatBusy 단일 정의).
export function useChatSessionsSync(): void {
  const inflight = useChatBusy()
  const recentsEpoch = useChatRecentsEpoch()
  const wasInflightRef = useRef(false)
  useEffect(() => {
    if (wasInflightRef.current && !inflight) void sessionsActions.refresh()
    wasInflightRef.current = inflight
  }, [inflight])
  useEffect(() => {
    if (recentsEpoch > 0) void sessionsActions.refresh()
  }, [recentsEpoch])
}
