import { describe, expect, it } from 'vitest'
import { claudeToNormalized, type MapContext } from './claude-map'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

const ctx = (sessionId = 's1'): MapContext => ({ sessionId, cwd: '/w' })
const sdk = (m: unknown): SDKMessage => m as SDKMessage

const structuredPatch = [
  {
    oldStart: 45,
    oldLines: 2,
    newStart: 45,
    newLines: 2,
    lines: ['   const frame = 0', '-async function animate() {', '+async function animate2() {']
  }
]

// SDK `FileEditOutput` 원본 — `originalFile` 은 편집 전 **파일 전체**다(0228 D-007).
const editOutput = {
  filePath: 'C:/w/hello_world.ts',
  oldString: 'animate',
  newString: 'animate2',
  originalFile: 'x'.repeat(4096),
  structuredPatch,
  userModified: false,
  replaceAll: false,
  gitDiff: { filename: 'hello_world.ts', status: 'modified', patch: 'noise' }
}

function mapEdit(
  toolName: string,
  toolUseResult: unknown,
  c: MapContext = ctx()
): ReturnType<typeof claudeToNormalized> {
  claudeToNormalized(
    sdk({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', id: 't1', name: toolName, input: { file_path: 'a.ts' } }]
      }
    }),
    c
  )
  return claudeToNormalized(
    sdk({
      type: 'user',
      tool_use_result: toolUseResult,
      message: {
        content: [{ type: 'tool_result', tool_use_id: 't1', content: 'updated', is_error: false }]
      }
    }),
    c
  )
}

function structured(events: ReturnType<typeof claudeToNormalized>): unknown {
  return (events[0] as { structuredOutput?: unknown }).structuredOutput
}

describe('편집 도구 구조화 패치 동행 (0228)', () => {
  // 0228 §10 EP-04 — 실리는 것은 패치뿐이다. 키 집합 동등이라 필드가 하나라도 늘면 실패한다.
  it('Edit tool_result 에 structuredPatch 만 투영해 싣는다', () => {
    const out = mapEdit('Edit', editOutput)
    expect(Object.keys(structured(out) as object)).toEqual(['structuredPatch'])
    expect(structured(out)).toEqual({ structuredPatch })
    expect(JSON.stringify(out)).not.toContain('originalFile')
    expect(JSON.stringify(out)).not.toContain('gitDiff')
  })

  it('Write/MultiEdit 에는 싣지 않는다 (D-009·D-010)', () => {
    expect(mapEdit('Write', editOutput)[0]).not.toHaveProperty('structuredOutput')
    expect(mapEdit('MultiEdit', editOutput)[0]).not.toHaveProperty('structuredOutput')
  })

  it('패치 형태가 어긋나면 싣지 않는다 (EP-05)', () => {
    expect(mapEdit('Edit', { ...editOutput, structuredPatch: undefined })[0]).not.toHaveProperty(
      'structuredOutput'
    )
    const skewed = [{ ...structuredPatch[0], newLines: 9 }]
    expect(mapEdit('Edit', { ...editOutput, structuredPatch: skewed })[0]).not.toHaveProperty(
      'structuredOutput'
    )
  })

  it('tool_result 블록이 여러 개면 귀속이 모호해 싣지 않는다 (0204 규칙 승계)', () => {
    const c = ctx()
    claudeToNormalized(
      sdk({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: 'a.ts' } },
            { type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: 'b.ts' } }
          ]
        }
      }),
      c
    )
    const out = claudeToNormalized(
      sdk({
        type: 'user',
        tool_use_result: editOutput,
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 't1', content: 'ok', is_error: false },
            { type: 'tool_result', tool_use_id: 't2', content: 'ok', is_error: false }
          ]
        }
      }),
      c
    )
    expect(out.every((event) => !Object.hasOwn(event, 'structuredOutput'))).toBe(true)
  })
})
