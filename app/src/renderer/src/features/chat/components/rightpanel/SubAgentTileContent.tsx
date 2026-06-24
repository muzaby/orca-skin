import { Button } from '../../../../shared/ui/Button'
import { AssistantMessage } from '../transcript/AssistantMessage'
import { childMessageForParentToolRunId, subagentTasksFromMessages } from '../../lib/parts'
import { chatActions, useChatSession } from '../../store/chatStore'

const STATUS_LABEL = {
  running: '진행 중',
  completed: '완료',
  failed: '실패',
  aborted: '중지됨'
} as const

const STATUS_CLASS = {
  running: 'text-accent',
  completed: 'text-t7',
  failed: 'text-bad',
  aborted: 'text-t6'
} as const

export function SubAgentTileContent(): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  const tasks = subagentTasksFromMessages(messages)
  const selected = selectedId ? tasks.find((task) => task.toolUseId === selectedId) : undefined
  const childMessage = selectedId ? childMessageForParentToolRunId(messages, selectedId) : null

  if (selected) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-g2 border-b border-t5 px-p4 py-p3">
          <Button size="small" onClick={() => chatActions.selectSubagentTask(null)}>
            ← 목록
          </Button>
          <div className="min-w-0 flex-1 truncate text-footnote font-semibold text-t9">
            {selected.description}
          </div>
          <span className={`shrink-0 text-caption ${STATUS_CLASS[selected.status]}`}>
            {STATUS_LABEL[selected.status]}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-p5 py-p4">
          <div className="mb-g4 rounded-r5 bg-bg2 px-p5 py-p4 text-body leading-[1.65] text-t8">
            {selected.description}
          </div>
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-t5 px-p5 py-p4">
        <div className="text-body font-semibold text-t9">백그라운드 작업</div>
      </div>
      {tasks.length === 0 ? (
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 px-4 text-center text-t6">
          <p className="text-footnote font-medium text-t6">백그라운드 작업이 없습니다</p>
          <p className="text-caption text-ink3">Task 도구 호출이 감지되면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-p5 py-p4">
          <div className="mb-g3 flex items-center text-footnote text-t6">
            <span>완료</span>
            <button type="button" className="ml-auto text-t6 hover:text-t8">
              지우기
            </button>
          </div>
          <div className="flex flex-col gap-g3">
            {tasks.map((task) => (
              <button
                key={task.toolUseId}
                type="button"
                onClick={() => chatActions.selectSubagentTask(task.toolUseId)}
                aria-label={`${task.description} 대화록 보기`}
                className="group/subagent rounded-r6 bg-bg2 px-p5 py-p4 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
              >
                <div className="flex min-w-0 items-center gap-g3">
                  <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-t6" />
                  <span className="min-w-0 flex-1 truncate text-body font-semibold text-t9">
                    {task.description}
                  </span>
                </div>
                <div className="mt-g1 pl-5 text-footnote text-ink3">
                  에이전트&nbsp;&nbsp;{task.agentLabel}
                  {task.durationLabel ? `  ${task.durationLabel}` : ''}
                </div>
                <div className="mt-g1 pl-5 text-footnote text-ink3">
                  {task.tokenLabel ? `${task.tokenLabel}  ` : ''}
                  {task.toolCountLabel}{' '}
                  <span className="font-medium text-accent group-hover/subagent:underline">
                    대화록 보기
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
