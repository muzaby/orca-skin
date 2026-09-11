import { describe, expect, it } from 'vitest'
import { toolCallPartPayload } from './tool-call-payload'

const started = (over: Record<string, unknown> = {}): Parameters<typeof toolCallPartPayload>[0] =>
  ({
    type: 'tool.call.started',
    sessionId: 's1',
    toolRunId: 't1',
    toolName: 'Edit',
    args: { file_path: 'a.ts' },
    ...over
  }) as Parameters<typeof toolCallPartPayload>[0]

describe('tool_call 파트 영속 payload', () => {
  it('영속 키는 toolName·args 두 개다', () => {
    expect(Object.keys(toolCallPartPayload(started()))).toEqual(['toolName', 'args'])
  })

  it('부모 tool_use id 가 있으면 그것만 더한다', () => {
    expect(Object.keys(toolCallPartPayload(started({ parentToolRunId: 'p1' })))).toEqual([
      'toolName',
      'args',
      'parentToolRunId'
    ])
  })

  // 0229 §10 EP-Δ5 — 실행 전 미리보기는 라이브 전용이라 DB 에 남지 않는다.
  it('editPreview 는 실려 와도 영속 payload 에 들어가지 않는다', () => {
    const payload = toolCallPartPayload(
      started({ editPreview: { structuredPatch: [{ oldStart: 1 }] } })
    )
    expect(Object.keys(payload)).toEqual(['toolName', 'args'])
    expect(JSON.stringify(payload)).not.toContain('structuredPatch')
  })

  it('args 부재는 null 로 굳힌다', () => {
    expect(toolCallPartPayload(started({ args: undefined })).args).toBeNull()
  })
})
