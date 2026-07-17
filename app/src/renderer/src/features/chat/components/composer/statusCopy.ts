import type { MessageKey } from '../../../../shared/i18n'

export type ConversationStatus = 'safe' | 'warn' | 'danger'

// 0064 r2 (사용자 확정): 단계별 권장 액션을 하나로 통일 — warn = 현재 세션 /compact 전송,
// danger = 핸드오프(요약을 이어받아 새 세션). "정리하고 새 대화 시작"(내용 미계승 새채팅)은
// 핸드오프와 혼동돼 제거(순수 새 채팅은 사이드바/헤더가 담당).
// 카피 문자열은 카탈로그(chat.status.*)로 이관 — 여기는 **키 테이블**만 둔다(0097).
// 0122 (사용자 확정): 오늘 사용량 행·디스클레이머 제거 — usage/disclaimer 키 폐기.
export interface StatusCopyKeys {
  pill: MessageKey
  detail: MessageKey
  title: MessageKey
  description: MessageKey
  length: MessageKey
  actionButton: MessageKey
}

export const STATUS_COPY_KEYS: Record<Exclude<ConversationStatus, 'safe'>, StatusCopyKeys> = {
  warn: {
    pill: 'chat.status.warn.pill',
    detail: 'chat.status.warn.detail',
    title: 'chat.status.warn.title',
    description: 'chat.status.warn.description',
    length: 'chat.status.warn.length',
    actionButton: 'chat.status.warn.actionButton'
  },
  danger: {
    pill: 'chat.status.danger.pill',
    detail: 'chat.status.danger.detail',
    title: 'chat.status.danger.title',
    description: 'chat.status.danger.description',
    length: 'chat.status.danger.length',
    actionButton: 'chat.status.danger.actionButton'
  }
}
