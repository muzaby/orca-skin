export type ConversationStatus = 'safe' | 'warn' | 'danger'

// 0064 r2 (사용자 확정): 단계별 권장 액션을 하나로 통일 — warn = 현재 세션 /compact 전송,
// danger = 핸드오프(요약을 이어받아 새 세션). "정리하고 새 대화 시작"(내용 미계승 새채팅)은
// 핸드오프와 혼동돼 제거(순수 새 채팅은 사이드바/헤더가 담당).
export const STATUS_COPY = {
  warn: {
    pill: '대화가 꽤 길어졌어요',
    detail: '자세히',
    title: '대화가 길어지고 있어요',
    description: '이대로 계속해도 되지만, 가볍게 정리하면 더 매끄럽게 이어갈 수 있어요.',
    length: '긴 편이에요',
    usage: '보통보다 조금 많아요',
    actionButton: '대화 가볍게 요약하기',
    disclaimer: '표시된 내용은 예상치예요. 실제와 조금 다를 수 있어요.'
  },
  danger: {
    pill: '대화가 아주 길어졌어요 — 정리가 필요해요',
    detail: '자세히',
    title: '대화가 아주 길어요',
    description:
      '요약본을 이어받는 새 세션(핸드오프)으로 넘어가는 편이 좋아요. 지금까지 내용은 그대로 남아요.',
    length: '아주 길어요',
    usage: '많은 편이에요',
    actionButton: '핸드오프로 이어가기',
    disclaimer: '표시된 내용은 예상치예요. 실제와 조금 다를 수 있어요.'
  }
} as const
