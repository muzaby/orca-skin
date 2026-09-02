import { readTaskToolObservation } from '../../../../../../../shared/task-tool'
import { useI18n, type MessageKey } from '../../../../../shared/i18n'
import type { ToolCall } from '../../../reducer/chatReducer'

// 세션 할 일 목록 도구(TaskCreate/TaskGet/TaskUpdate/TaskList) 전용 본문 — 0212 R-06.
//
// **파싱을 다시 만들지 않는다.** 목록 파생과 같은 `readTaskToolObservation` 을 부른다: 여기서
// `structuredOutput` 을 따로 shape-sniff 하면 SDK 가 필드를 바꿀 때 대화록과 패널이 서로 다른
// 말을 한다. 이 컴포넌트가 하는 일은 그 관측을 **문장으로 옮기는 것**뿐이다.
//
// `TaskOutput`/`TaskStop` 은 이 본문의 대상이 아니다(0212 D-025) — 구조화 출력 타입이 없어
// 그릴 필드가 없고 목록도 바꾸지 않는다(0204 D-010). 그 둘은 기존 `KeyValueBody` 폴백에 남는다.

// 실패한 갱신의 사유 문구. `readTaskToolObservation` 은 실패를 `null` 로 접으므로(fail-closed)
// 여기서 출력의 `error` 를 직접 읽는다 — 목록에는 닿지 않지만 **대화록에는 원인이 남아야 한다**
// (0212 D-016: 존재하지 않는 taskId 갱신이 실패의 주 사례이고, 그때 패널에는 걸 항목이 없다).
function errorText(call: ToolCall): string | null {
  const structured = call.result?.structuredOutput
  if (typeof structured !== 'object' || structured === null) return null
  const error = (structured as Record<string, unknown>).error
  return typeof error === 'string' && error.trim() !== '' ? error : null
}

const KIND_KEY: Record<string, MessageKey> = {
  created: 'chat.taskTool.created',
  upserted: 'chat.taskTool.updated',
  removed: 'chat.taskTool.removed',
  snapshot: 'chat.taskTool.listed'
}

export function TaskToolBody({ call }: { call: ToolCall }): React.JSX.Element {
  const { tr } = useI18n()
  const observation = call.result
    ? readTaskToolObservation({
        toolName: call.name,
        args: call.input,
        structuredOutput: call.result.structuredOutput,
        isError: call.result.isError
      })
    : null
  const error = errorText(call)

  return (
    <div className="flex flex-col gap-1 whitespace-pre-wrap break-words text-t9">
      {observation === null ? (
        // 결과 미도착이거나 실패 — 어느 쪽이든 목록은 바뀌지 않았다. 사유가 있으면 그것을 말한다.
        <div>
          <span className="text-t6">{tr('chat.taskTool.failed')}: </span>
          {error ?? tr('chat.taskTile.stopFailed')}
        </div>
      ) : observation.kind === 'snapshot' ? (
        <div>
          <span className="text-t6">{tr(KIND_KEY.snapshot)}: </span>
          {tr('chat.taskTool.count', { count: observation.tasks.length })}
        </div>
      ) : (
        <>
          <div>
            <span className="text-t6">{tr(KIND_KEY[observation.kind])}: </span>
            {`#${observation.id}`}
          </div>
          {observation.kind !== 'removed' && observation.patch.subject && (
            <div>
              <span className="text-t6">{tr('chat.taskTool.subject')}: </span>
              {observation.patch.subject}
            </div>
          )}
          {observation.kind !== 'removed' && observation.patch.status && (
            <div>
              <span className="text-t6">{tr('chat.taskTool.status')}: </span>
              {observation.patch.status}
            </div>
          )}
        </>
      )}
    </div>
  )
}
