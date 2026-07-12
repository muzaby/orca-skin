import { STATUS_COPY_KEYS, type ConversationStatus, type StatusCopyKeys } from './statusCopy'

// 0064 r2: 단계별 단일 권장 액션 — warn = 현재 세션에 /compact 사용자 턴 전송,
// danger = 핸드오프(요약 계승 새 세션). 구 compact 스텁/새 대화 버튼 폐기.
// 카피는 카탈로그 키(labelKeys)로 노출 — 소비자(ConversationStatusLine/StatusPopover)가
// 렌더에서 tr() 해석한다(0097). costToday 는 이미 포맷된 원문 통과.
export interface StatusLineModel {
  state: Exclude<ConversationStatus, 'safe'>
  action: 'compact' | 'handoff'
  labelKeys: StatusCopyKeys
  costToday?: string
}

export function conversationStatusModel(
  state: ConversationStatus,
  costToday?: string
): StatusLineModel | null {
  if (state === 'safe') return null

  return {
    state,
    action: state === 'warn' ? 'compact' : 'handoff',
    labelKeys: STATUS_COPY_KEYS[state],
    ...(costToday ? { costToday } : {})
  }
}
