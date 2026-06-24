import { Button } from '../../../../shared/ui/Button'
import { AssistantMessage } from '../transcript/AssistantMessage'
import { childMessageForParentToolRunId, subagentTasksFromMessages } from '../../lib/parts'
import { chatActions, useChatSession } from '../../store/chatStore'

const STATUS_LABEL = {
  running: '진행 중',
  completed: '완료',
  failed: '실패'
} as const

const STATUS_CLASS = {
  running: 'text-accent',
  completed: 'text-t7',
  failed: 'text-bad'
} as const

export function SubAgentTileContent(): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  const tasks = subagentTasksFromMessages(messages)
  const selected = selectedId ? tasks.find((task) => task.toolUseId === selectedId) : undefined
  const childMessage = selectedId ? childMessageForParentToolRunId(messages, selectedId) : null

  if (tasks.length === 0) {
    return (
      <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 px-4 text-center text-t6">
        <p className="text-footnote font-medium text-t6">아직 서브 에이전트 출력이 없습니다</p>
        <p className="text-caption text-ink3">Task 도구 호출이 감지되면 여기에 표시됩니다.</p>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-g2 border-b border-t5 px-3 py-2">
          <Button size="small" onClick={() => chatActions.selectSubagentTask(null)}>
            ← 목록
          </Button>
          <div className="min-w-0 flex-1 truncate text-caption font-semibold text-t8">
            {selected.description}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {childMessage ? (
            <AssistantMessage message={childMessage} />
          ) : (
            <div className="rounded-r5 border border-t5 bg-bg2 p-4 text-footnote text-ink3">
              이 Task 에 연결된 child 도구 호출이 없습니다.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-g3 overflow-auto p-3">
      {tasks.map((task) => (
        <button
          key={task.toolUseId}
          type="button"
          onClick={() => chatActions.selectSubagentTask(task.toolUseId)}
          className="group/subagent rounded-r5 border border-t5 bg-bg2 p-3 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
        >
          <div className="flex items-center gap-g2">
            <span className="min-w-0 flex-1 truncate text-footnote font-semibold text-t9">
              {task.description}
            </span>
            <span className={`shrink-0 text-caption ${STATUS_CLASS[task.status]}`}>
              {STATUS_LABEL[task.status]}
            </span>
          </div>
          <div className="mt-1 text-caption text-ink3">
            child 도구 {task.childToolCount}개 · {task.call.name}
          </div>
        </button>
      ))}
    </div>
  )
}
