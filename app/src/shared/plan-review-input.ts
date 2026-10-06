import type { PermissionAction } from './ipc'
import { isRecord } from './obj'

// 승인 시점 정본 입력의 상관키. 메인 ExitPlanMode만 기존 도구 입력을 교정한다.
export function planReviewToolInput(
  action: PermissionAction
): { toolUseId: string; input: Record<string, unknown> } | undefined {
  const source = action.providerRequest
  if (
    action.kind !== 'plan_review' ||
    source?.agentId !== undefined ||
    typeof source?.toolUseId !== 'string' ||
    source.toolUseId.trim() === '' ||
    !isRecord(action.input)
  )
    return undefined
  return { toolUseId: source.toolUseId, input: action.input }
}
