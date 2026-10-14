import type { ToolCall } from '../../../reducer/chatReducer'
import { toolKind } from '../toolPresentation'

const exploration = (call: ToolCall): boolean => ['read', 'search', 'list'].includes(toolKind(call))

// 연속한 탐색만 묶어 shell/edit 전후의 출력 순서를 보존한다.
export function groupTools(calls: ToolCall[]): ToolCall[][] {
  const groups: ToolCall[][] = []
  for (const call of calls) {
    const last = groups.at(-1)
    if (last && exploration(call) && exploration(last[0])) last.push(call)
    else groups.push([call])
  }
  return groups
}
