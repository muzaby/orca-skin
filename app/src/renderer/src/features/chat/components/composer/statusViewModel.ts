import { STATUS_COPY, type ConversationStatus } from './statusCopy'

// 0064 r2: 단계별 단일 권장 액션 — warn = 현재 세션에 /compact 사용자 턴 전송,
// danger = 핸드오프(요약 계승 새 세션). 구 compact 스텁/새 대화 버튼 폐기.
export interface StatusLineModel {
  state: Exclude<ConversationStatus, 'safe'>
  action: 'compact' | 'handoff'
  labels: {
    pill: string
    detail: string
    title: string
    description: string
    length: string
    usage: string
    costToday?: string
    actionButton: string
    disclaimer: string
  }
}

export function conversationStatusModel(
  state: ConversationStatus,
  costToday?: string
): StatusLineModel | null {
  if (state === 'safe') return null

  const copy = STATUS_COPY[state]
  return {
    state,
    action: state === 'warn' ? 'compact' : 'handoff',
    labels: {
      pill: copy.pill,
      detail: copy.detail,
      title: copy.title,
      description: copy.description,
      length: copy.length,
      usage: copy.usage,
      ...(costToday ? { costToday } : {}),
      actionButton: copy.actionButton,
      disclaimer: copy.disclaimer
    }
  }
}
