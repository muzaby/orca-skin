import { Button } from '../../../../shared/ui/Button'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { AssistantMessage } from '../transcript/AssistantMessage'
import {
  childMessageForParentToolRunId,
  subagentTasksFromMessages,
  type SubagentTaskStatus
} from '../../lib/parts'
import { chatActions, useChatSession } from '../../store/chatStore'
import type { ToolCall } from '../../reducer/chatReducer'

const STATUS_LABEL: Record<SubagentTaskStatus, string> = {
  running: '진행 중',
  completed: '완료',
  failed: '실패',
  aborted: '중지됨'
}

function promptFromCall(call: ToolCall): string | null {
  const input = call.input
  if (typeof input === 'object' && input !== null) {
    const prompt = (input as Record<string, unknown>).prompt
    if (typeof prompt === 'string' && prompt.trim() !== '') return prompt
  }
  return null
}

// 타일 헤더 콘텐츠 — 상세(Task 선택)면 뒤로가기 + Task 제목, 목록이면 '백그라운드 작업'.
// RightPanelTile 의 기본 라벨 span 을 대체한다(tileRegistry 주입). 제목 폰트/톤은 기본 라벨과 일치.
export function SubAgentTileHeader(): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  const selected = selectedId
    ? subagentTasksFromMessages(messages).find((task) => task.toolUseId === selectedId)
    : undefined

  if (selected) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-g1">
        <Button
          iconOnly
          size="small"
          leadingIcon="arrowL"
          onClick={() => chatActions.selectSubagentTask(null)}
          aria-label="목록으로"
        />
        <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
          {selected.description}
        </span>
      </div>
    )
  }
  return (
    <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
      백그라운드 작업
    </span>
  )
}

export function SubAgentTileContent(): React.JSX.Element {
  const messages = useChatSession((s) => s.messages)
  const selectedId = useChatSession((s) => s.selectedSubagentTaskId)
  const tasks = subagentTasksFromMessages(messages)
  const selected = selectedId ? tasks.find((task) => task.toolUseId === selectedId) : undefined
  const childMessage = selectedId ? childMessageForParentToolRunId(messages, selectedId) : null

  // 상세 — Task 프롬프트(있으면) + child 트랜스크립트를 메인 transcript 컴포넌트로 렌더.
  // 뒤로가기/제목은 타일 헤더(SubAgentTileHeader)가 담당하므로 본문엔 헤더를 두지 않는다.
  if (selected) {
    const prompt = promptFromCall(selected.call)
    return (
      <div className="min-h-0 flex-1 overflow-auto px-p5 py-p4">
        {prompt && (
          <div className="mb-g4 text-body leading-[1.7] text-ink">
            <Markdown source={prompt} />
          </div>
        )}
        {childMessage ? (
          <AssistantMessage message={childMessage} />
        ) : (
          <div className="rounded-r5 border border-t5 bg-bg2 p-4 text-footnote text-ink3">
            이 작업에 기록된 하위 도구 호출이 없습니다.
          </div>
        )}
      </div>
    )
  }

  // 목록 — 백그라운드 작업 카드들(이미지 8). 제목은 타일 헤더가 표시한다.
  if (tasks.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 px-4 text-center">
          <p className="text-footnote font-medium text-t6">백그라운드 작업이 없습니다</p>
          <p className="text-caption text-ink3">Task 도구 호출이 감지되면 여기에 표시됩니다.</p>
        </div>
      </div>
    )
  }

  return (
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
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-t6" />
              <span className="min-w-0 flex-1 truncate text-body font-semibold text-t9">
                {task.description}
              </span>
            </div>
            <div className="mt-g1 pl-5 text-footnote text-ink3">
              에이전트&nbsp;&nbsp;{STATUS_LABEL[task.status]}
              {task.durationLabel ? `\u00A0\u00A0${task.durationLabel}` : ''}
            </div>
            <div className="mt-g1 pl-5 text-footnote text-ink3">
              {task.tokenLabel ? `${task.tokenLabel}\u00A0\u00A0` : ''}
              {task.toolCountLabel}
              {'\u00A0\u00A0'}
              <span className="font-medium text-accent group-hover/subagent:underline">
                대화록 보기
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
