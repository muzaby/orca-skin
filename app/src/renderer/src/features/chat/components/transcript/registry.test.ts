import { describe, it, expect } from 'vitest'
import { toolRendererRegistry } from './registry'
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
