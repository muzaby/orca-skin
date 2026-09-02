// ToolRendererRegistry — 도구 본문 렌더링을 도구 이름 switch 대신 시맨틱 RenderableKind 로 해소한다
// (rendering.md §1.6). 새 도구/엔진은 도구이름 분기를 늘리는 대신 renderer 를 register 한다.
// match 는 ToolCall(= tool_call+tool_result 파트 페어의 렌더 view) 기준 — 이름뿐 아니라 result
// shape 도 검사할 수 있다(§1.6 "이벤트 타입이 아니라 의미로 분류"). OpenCode 도구도 같은 kind 로
// 매핑된다(seam).
//
// 매칭 로직(resolve)은 순수 함수라 단위 테스트 대상. Body 는 JSX 를 반환하는 컴포넌트 참조.

import type { ToolCall } from '../../reducer/chatReducer'
import { FILE_EDIT_TOOLS } from '../../lib/toolMeta'
import { isAgentTaskName } from '../../lib/parts'
import { isTaskListToolName } from '../../../../../../shared/task-tool'
import { BashBody } from './tool-bodies/BashBody'
import { DiffBody } from './tool-bodies/DiffBody'
import { FileBody } from './tool-bodies/FileBody'
import { AskBody } from './tool-bodies/AskBody'
import { AgentTaskBody } from './tool-bodies/AgentTaskBody'
import { TaskToolBody } from './tool-bodies/TaskToolBody'
import { KeyValueBody } from './tool-bodies/KeyValueBody'

// 렌더 카드의 시맨틱 종류 (rendering.md §1.6 정본 taxonomy). 도구 이름이 아니라 "무엇을
// 보여주는가" 로 분류한다. 본 레지스트리는 *도구 본문*(tool_call 파트)만 다루므로 그중
// terminal·file_preview·diff·ask·generic 만 등록한다. error / structured_output 은 비-도구
// 파트라 AssistantMessage 가 전용 카드(ErrorCard/StructuredOutputCard)로 직접 렌더한다.
// search · agent_task · session_graph · context_injection · approval · telemetry 는 OpenCode/
// 별도 표면 전용이라 여기선 seam(미등록).
export type RenderableKind =
  | 'terminal'
  | 'file_preview'
  | 'diff'
  | 'search'
  | 'approval'
  | 'agent_task'
  // 세션 할 일 목록 도구(TaskCreate/TaskGet/TaskUpdate/TaskList)의 본문 — 0212 R-06.
  // `agent_task`(서브에이전트 실행)와 **다른 의미**다: 저것은 프로세스를 띄우고 이것은 할 일
  // 목록을 바꾼다. 같은 kind 로 접으면 두 카드가 같은 것을 보여준다고 말하게 된다.
  | 'task_list'
  | 'session_graph'
  | 'context_injection'
  | 'structured_output'
  | 'error'
  | 'telemetry'
  // 비정본 실용 kind: 미지 도구 fallback / AskUserQuestion 컴팩트 본문.
  | 'generic'
  | 'ask'

export interface ToolRenderer {
  kind: RenderableKind
  match: (call: ToolCall) => boolean
  Body: (props: { call: ToolCall }) => React.JSX.Element
}

export class ToolRendererRegistry {
  private readonly renderers: ToolRenderer[] = []

  // 미지 도구의 폴백(타 SDK 도 합리적 렌더). 생성 시 필수.
  constructor(private readonly fallback: ToolRenderer) {}

  register(r: ToolRenderer): this {
    this.renderers.push(r)
    return this
  }

  // 첫 match 를 반환, 없으면 fallback. 등록 순서가 우선순위.
  resolve(call: ToolCall): ToolRenderer {
    return this.renderers.find((r) => r.match(call)) ?? this.fallback
  }
}

// 기본 레지스트리 — 현행 ToolCard switch 와 동치. fallback=generic(KeyValueBody).
export const toolRendererRegistry = new ToolRendererRegistry({
  kind: 'generic',
  match: () => true,
  Body: KeyValueBody
})
  .register({
    kind: 'terminal',
    match: (c) => c.name === 'Bash' || c.name === 'PowerShell',
    Body: BashBody
  })
  .register({ kind: 'diff', match: (c) => FILE_EDIT_TOOLS.has(c.name), Body: DiffBody })
  .register({ kind: 'file_preview', match: (c) => c.name === 'Read', Body: FileBody })
  .register({
    kind: 'agent_task',
    match: (c) => isAgentTaskName(c.name),
    Body: AgentTaskBody
  })
  // 이름 배열의 소유자는 `shared/task-tool.ts` 하나다(0212 §10 EP-11) — 여기서 리터럴을 다시
  // 적으면 CLI 가 이름을 바꿀 때 두 곳이 갈라진다. 6종 전량(`TASK_TOOL_NAMES`)이 아니라 **할 일
  // 목록 4종**만 받는다(D-025).
  .register({
    kind: 'task_list',
    match: (c) => isTaskListToolName(c.name),
    Body: TaskToolBody
  })
  .register({ kind: 'ask', match: (c) => c.name === 'AskUserQuestion', Body: AskBody })
