import { describe, it, expect } from 'vitest'
import {
  VERB_LABEL,
  VERB_LABEL_ACTIVE,
  summarizeToolGroup,
  toolDescription,
  toolDiffStat,
  toolGroupSegments,
  toolVerbCategory
} from './toolMeta'
import type { ToolCall } from '../reducer/chatReducer'

const call = (name: string, input: unknown, done = true): ToolCall => ({
  toolUseId: `${name}-${Math.random()}`,
  name,
  input,
  ...(done ? { result: { output: '', isError: false } } : {})
})

const errorCall = (name: string, input: unknown): ToolCall => ({
  toolUseId: `${name}-${Math.random()}`,
  name,
  input,
  result: { output: '', isError: true }
})

describe('toolVerbCategory', () => {
  it('도구 이름을 카테고리로 매핑한다', () => {
    expect(toolVerbCategory('Bash')).toBe('ran')
    expect(toolVerbCategory('PowerShell')).toBe('ran')
    expect(toolVerbCategory('Write')).toBe('created')
    expect(toolVerbCategory('Edit')).toBe('edited')
    expect(toolVerbCategory('ExitPlanMode')).toBe('planned')
    expect(toolVerbCategory('AskUserQuestion')).toBe('requested')
    expect(toolVerbCategory('Read')).toBe('read')
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

  it('AskUserQuestion 은 첫 질문 header', () => {
    expect(
      toolDescription(
        call('AskUserQuestion', {
          questions: [{ header: '배포 방식', question: '어떻게 배포할까요?' }]
        })
      )
    ).toBe('배포 방식')
  })

  it('Bash 는 description 없으면 명령 첫 줄로 폴백', () => {
    expect(toolDescription(call('Bash', { command: 'ls' }))).toBe('ls')
    expect(toolDescription(call('Bash', { command: 'npm test\nnpm run build' }))).toBe('npm test')
  })

  it('서술을 못 찾으면 도구 이름으로 폴백', () => {
    expect(toolDescription(call('Unknown', null))).toBe('Unknown')
  })
})

describe('toolDiffStat', () => {
  it('Write 는 content 라인 전부 added', () => {
    expect(toolDiffStat(call('Write', { file_path: 'a', content: 'l1\nl2\nl3' }))).toEqual({
      added: 3,
      removed: 0
    })
  })

  it('Edit 는 old/new diff 카운트', () => {
    expect(
      toolDiffStat(call('Edit', { file_path: 'a', old_string: 'a\nb', new_string: 'a\nB\nc' }))
    ).toEqual({ added: 2, removed: 1 })
  })

  it('MultiEdit 는 edit 합산', () => {
    const stat = toolDiffStat(
      call('MultiEdit', {
        file_path: 'a',
        edits: [
          { old_string: '', new_string: 'x' },
          { old_string: 'y', new_string: '' }
        ]
      })
    )
    expect(stat).toEqual({ added: 1, removed: 1 })
  })

  it('diff 대상 아닌 도구는 null', () => {
    expect(toolDiffStat(call('Bash', { command: 'ls' }))).toBeNull()
  })
})

describe('VERB_LABEL / VERB_LABEL_ACTIVE', () => {
  it('완료 시제와 진행 시제가 모든 카테고리에 정의됨', () => {
    const cats = ['ran', 'created', 'edited', 'read', 'used', 'planned', 'requested'] as const
    for (const c of cats) {
      expect(VERB_LABEL[c]).toBeTruthy()
      expect(VERB_LABEL_ACTIVE[c]).toBeTruthy()
      expect(VERB_LABEL_ACTIVE[c]).not.toBe(VERB_LABEL[c])
    }
    expect(VERB_LABEL.ran).toBe('실행됨')
    expect(VERB_LABEL_ACTIVE.ran).toBe('실행 중')
  })

  it('Claude Code 어휘 라벨', () => {
    expect(VERB_LABEL.created).toBe('업데이트됨')
    expect(VERB_LABEL.edited).toBe('수정됨')
    expect(VERB_LABEL.read).toBe('읽음')
    expect(VERB_LABEL_ACTIVE.read).toBe('읽는 중')
  })
})

describe('toolGroupSegments', () => {
  it('실패 카테고리에 hasError 플래그', () => {
    const segs = toolGroupSegments([
      errorCall('Bash', { command: 'a' }),
      call('Write', { file_path: 'x', content: 'y' })
    ])
    const ran = segs.find((s) => s.category === 'ran')
    const created = segs.find((s) => s.category === 'created')
    expect(ran?.hasError).toBe(true)
    expect(created?.hasError).toBe(false)
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
    expect(summarizeToolGroup(calls)).toBe('실행됨 명령 3개, 업데이트됨 파일 3개')
  })

  it('Read 는 read 카테고리, Glob 등은 used 도구', () => {
    expect(
      summarizeToolGroup([call('Read', { file_path: 'a' }), call('Glob', { pattern: 'b' })])
    ).toBe('읽음 파일 1개, 사용함 도구 1개')
  })

  it('planned 싱글톤은 카운트 없이 명사 라벨만', () => {
    expect(summarizeToolGroup([call('ExitPlanMode', { plan: '...' })])).toBe('제안된 계획')
  })
})
