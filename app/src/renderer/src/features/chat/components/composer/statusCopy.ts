export type ConversationStatus = 'safe' | 'warn' | 'danger'

export const STATUS_COPY = {
  warn: {
    pill: '대화가 꽤 길어졌어요',
    detail: '자세히',
    title: '대화가 길어지고 있어요',
    description: '이대로 계속해도 되지만, 가볍게 정리하면 더 매끄럽게 이어갈 수 있어요.',
    length: '긴 편이에요',
    usage: '보통보다 조금 많아요',
    compactButton: '대화 가볍게 요약하기',
    newChatButton: '정리하고 새 대화 시작',
    disclaimer: '표시된 내용은 예상치예요. 실제와 조금 다를 수 있어요.'
  },
  danger: {
    pill: '대화가 아주 길어졌어요 — 정리가 필요해요',
    detail: '자세히',
    title: '대화가 아주 길어요',
    description: '지금은 정리하고 새로 시작하는 편이 좋아요. 지금까지 내용은 그대로 남아요.',
    length: '아주 길어요',
    usage: '많은 편이에요',
    newChatButton: '정리하고 새 대화 시작',
    disclaimer: '표시된 내용은 예상치예요. 실제와 조금 다를 수 있어요.'
  }
} as const
