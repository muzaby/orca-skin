import { describe, it, expect } from 'vitest'
import { toolRendererRegistry } from './registry'
import { TaskToolBody } from './tool-bodies/TaskToolBody'
import { TASK_LIST_TOOL_NAMES, TASK_TOOL_NAMES } from '../../../../../../shared/task-tool'
import type { ToolCall } from '../../reducer/chatReducer'

const call = (name: string, result?: ToolCall['result']): ToolCall => ({
  toolUseId: 't',
  name,
  input: {},
  ...(result ? { result } : {})
})

describe('ToolRendererRegistry.resolve', () => {
  it('Bash/PowerShell → terminal', () => {
    expect(toolRendererRegistry.resolve(call('Bash')).kind).toBe('terminal')
    expect(toolRendererRegistry.resolve(call('PowerShell')).kind).toBe('terminal')
  })

  it('Write/Edit/MultiEdit → diff', () => {
    expect(toolRendererRegistry.resolve(call('Write')).kind).toBe('diff')
    expect(toolRendererRegistry.resolve(call('Edit')).kind).toBe('diff')
    expect(toolRendererRegistry.resolve(call('MultiEdit')).kind).toBe('diff')
  })

  it('Read → file_preview, AskUserQuestion → ask', () => {
    expect(toolRendererRegistry.resolve(call('Read')).kind).toBe('file_preview')
    expect(toolRendererRegistry.resolve(call('AskUserQuestion')).kind).toBe('ask')
  })

  it('미지 도구 → generic 폴백', () => {
    expect(toolRendererRegistry.resolve(call('SomeUnknownTool')).kind).toBe('generic')
    expect(toolRendererRegistry.resolve(call('mcp__foo__bar')).kind).toBe('generic')
  })

  it('match 는 ToolCall 전체를 받는다(result shape 검사 가능)', () => {
    // 현재 등록 렌더러는 이름 기준이지만, 시그니처가 ToolCall 이라 result 도 접근 가능.
    const c = call('Read', { output: 'data', isError: false })
    expect(toolRendererRegistry.resolve(c).kind).toBe('file_preview')
  })
})

// 0212 AC22(ΔV1) — **관측 지점은 `resolve` 다.** `TaskToolBody` 를 직접 부르는 렌더 단언은
// 등록 블록을 통째로 지워도 초록이라 이 AC 를 닫지 못한다(r1 verify D1: MV-1 등록 삭제 ·
// MV-2 match 6종 확장이 둘 다 무음이었다). 이름 분모의 소유자는 `shared/task-tool.ts`
// 하나다(§10 EP-11) — 여기서 리터럴 배열을 다시 적으면 SSOT 가 갈라져도 눈치채지 못한다.
describe('0212 AC22 — Task 도구 6종의 kind 를 레지스트리가 정한다', () => {
  const listNames: ReadonlySet<string> = new Set(TASK_LIST_TOOL_NAMES)
  const nonListNames = TASK_TOOL_NAMES.filter((name) => !listNames.has(name))

  it('6종은 할 일 목록 4종과 비-목록 2종으로 갈린다 — 차집합 자체를 못박는다', () => {
    // 음성 루프가 조용히 비지 않게 하는 가드다. 4종이 6종으로 넓어지면(EP-11 이 금지한 상태)
    // 아래 폴백 단언이 0회 돌아 통과하는데, 그 침묵을 이 줄이 먼저 깬다.
    expect(TASK_TOOL_NAMES).toHaveLength(6)
    expect([...TASK_LIST_TOOL_NAMES]).toEqual(['TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate'])
    expect(nonListNames).toEqual(['TaskOutput', 'TaskStop'])
  })

  it('할 일 목록 4종 → task_list 전용 본문', () => {
    for (const name of TASK_LIST_TOOL_NAMES) {
      const renderer = toolRendererRegistry.resolve(call(name))
      expect(renderer.kind, name).toBe('task_list')
      expect(renderer.Body, name).toBe(TaskToolBody)
    }
  })

  it('TaskOutput·TaskStop → generic 폴백 — 구조화 출력이 없어 그릴 필드가 0이다(D-025)', () => {
    for (const name of nonListNames) {
      const renderer = toolRendererRegistry.resolve(call(name))
      expect(renderer.kind, name).toBe('generic')
      expect(renderer.Body, name).not.toBe(TaskToolBody)
    }
  })
})
