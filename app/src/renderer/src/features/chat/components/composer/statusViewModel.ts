import { STATUS_COPY_KEYS, type ConversationStatus, type StatusCopyKeys } from './statusCopy'

// 0064 r2: 단계별 단일 권장 액션 — warn = 현재 세션에 /compact 사용자 턴 전송,
// danger = 핸드오프(요약 계승 새 세션). 구 compact 스텁/새 대화 버튼 폐기.
// 카피는 카탈로그 키(labelKeys)로 노출 — 소비자(ConversationStatusLine/StatusPopover)가
// 렌더에서 tr() 해석한다(0097). 0122: 오늘 사용량/비용 행 제거(costToday 폐기), 대화 길이
// 행에 병기할 수치(contextUsage)를 도넛과 동일 파생값에서 계산해 노출. 0122 r2: 세션 한정
// 비용 총합(sessionCostUsd — 로드 시드 + telemetry 누산, chatReducer 소유) 패스스루.
export interface ContextUsage {
  usedK: number
  windowK: number
  pct: number
}

export interface StatusLineModel {
  state: Exclude<ConversationStatus, 'safe'>
  action: 'compact' | 'handoff'
  labelKeys: StatusCopyKeys
  contextUsage?: ContextUsage
  sessionCostUsd?: number
}

export function conversationStatusModel(
  state: ConversationStatus,
  usage?: { tokens: number; window: number },
  sessionCostUsd?: number
): StatusLineModel | null {
  if (state === 'safe') return null

  return {
    state,
    action: state === 'warn' ? 'compact' : 'handoff',
    labelKeys: STATUS_COPY_KEYS[state],
    ...(usage && usage.window > 0
      ? {
          contextUsage: {
            usedK: Math.round(usage.tokens / 1000),
            windowK: Math.round(usage.window / 1000),
            pct: Math.round((usage.tokens / usage.window) * 100)
          }
        }
      : {}),
    ...(sessionCostUsd != null ? { sessionCostUsd } : {})
  }
}
