import { useMemo } from 'react'
import { useChatSession } from '../store/chatStore'
import { taskBoardForMessages, taskBoardOrdered, type TaskBoardItem } from '../lib/taskBoard'

// Coding 계획과 Work 진행 영역이 같은 세션 fold·정렬을 소비한다. 표시 위치는 데이터 순서를
// 바꾸지 않으며 기존 messages identity 캐시를 그대로 사용한다.
export function useTaskBoard(): TaskBoardItem[] {
  const messages = useChatSession((s) => s.messages)
  return useMemo(() => taskBoardOrdered(taskBoardForMessages(messages)), [messages])
}
