import { useMemo } from 'react'
import { useTranscriptView } from '../store/chatStore'
import { taskBoardOrdered, type TaskBoardItem } from '../lib/taskBoard'

// Code 계획과 Work 진행 영역이 같은 세션 색인·정렬을 소비한다.
export function useTaskBoard(): TaskBoardItem[] {
  const board = useTranscriptView('taskBoard')
  return useMemo(() => taskBoardOrdered([...board]), [board])
}
