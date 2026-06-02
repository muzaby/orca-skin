import { describe, it, expect } from 'vitest'
import { summarizeToolGroup, toolDescription, toolVerbCategory } from './toolMeta'
import type { ToolCall } from '../reducer/chatReducer'

const call = (name: string, input: unknown, done = true): ToolCall => ({
  toolUseId: `${name}-${Math.random()}`,
  name,
  input,
  ...(done ? { result: { output: '', isError: false } } : {})
})

describe('toolVerbCategory', () => {
  it('도구 이름을 카테고리로 매핑한다', () => {
    expect(toolVerbCategory('Bash')).toBe('ran')
    expect(toolVerbCategory('PowerShell')).toBe('ran')
    expect(toolVerbCategory('Write')).toBe('created')
    expect(toolVerbCategory('Edit')).toBe('edited')
    expect(toolVerbCategory('ExitPlanMode')).toBe('planned')
    expect(toolVerbCategory('Read')).toBe('used')
    expect(toolVerbCategory('Glob')).toBe('used')
    expect(toolVerbCategory('mcp__server__tool')).toBe('used')
  })
})

describe('toolDescription', () => {
  it('input.description 를 최우선으로 쓴다', () => {
    expect(
      toolDescription(call('Bash', { command: 'ls', description: 'List repository contents' }))
    ).toBe('List repository contents')
  })

  it('Write/Edit/Read 는 file_path basename 으로 fallback', () => {
    expect(toolDescription(call('Write', { file_path: 'C:\\Users\\me\\hello.py' }))).toBe(
      'hello.py'
    )
    expect(toolDescription(call('Edit', { file_path: '/home/user/src/index.ts' }))).toBe('index.ts')
  })

  it('Glob/Grep 은 pattern 으로 fallback', () => {
    expect(toolDescription(call('Grep', { pattern: 'TODO' }))).toBe('TODO')
  })

  it('ExitPlanMode 는 명사 라벨', () => {
    expect(toolDescription(call('ExitPlanMode', { plan: '...' }))).toBe('제안된 계획')
  })

  it('서술을 못 찾으면 도구 이름으로 폴백', () => {
    expect(toolDescription(call('Bash', { command: 'ls' }))).toBe('Bash')
    expect(toolDescription(call('Unknown', null))).toBe('Unknown')
  })
})

describe('summarizeToolGroup', () => {
  it('카테고리별 카운트를 정해진 순서로 조립한다', () => {
    const calls = [
      call('Bash', { command: 'a' }),
      call('Bash', { command: 'b' }),
      call('Bash', { command: 'c' }),
      call('Write', { file_path: 'x' }),
      call('Write', { file_path: 'y' }),
      call('Write', { file_path: 'z' })
    ]
    expect(summarizeToolGroup(calls)).toBe('실행됨 명령 3개, 생성됨 파일 3개')
  })

  it('used 카테고리는 도구 단위', () => {
    expect(
      summarizeToolGroup([call('Read', { file_path: 'a' }), call('Glob', { pattern: 'b' })])
    ).toBe('사용함 도구 2개')
  })

  it('planned 싱글톤은 카운트 없이 명사 라벨만', () => {
    expect(summarizeToolGroup([call('ExitPlanMode', { plan: '...' })])).toBe('제안된 계획')
  })
})
