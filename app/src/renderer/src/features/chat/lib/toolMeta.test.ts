import { describe, it, expect } from 'vitest'
import {
  FILE_EDIT_TOOLS,
  FILE_TOOLS,
  UNIT_KEY,
  VERB_KEY,
  VERB_KEY_ABORTED,
  VERB_KEY_ACTIVE,
  formatDurationLabel,
  formatTokenLabel,
  toolDescription,
  toolDiffStat,
  toolGroupSegments,
  toolVerbCategory,
  type VerbCategory
} from './toolMeta'
import { ko } from '../../../shared/i18n/resources/ko'
import type { ToolCall } from '../reducer/chatReducer'

// ko 카탈로그에서 dot-path 리프를 해석한다 — 키맵 완전성 검증용(i18next 미기동, 순수 조회).
function koLeaf(path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        typeof acc === 'object' && acc !== null ? (acc as Record<string, unknown>)[key] : undefined,
      ko
    )
  return typeof value === 'string' ? value : undefined
}

// 보간만 흉내내는 미니 tr — plural 없는 키(duration/tokens) 포맷 테스트용.
function fakeTr(key: string, params?: Record<string, unknown>): string {
  let value = koLeaf(key) ?? key
  for (const [k, v] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{{${k}}}`, String(v))
  }
  return value
}

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

  it('서브에이전트 도구(Task/Agent — isAgentTaskName)는 delegated', () => {
    expect(toolVerbCategory('Task')).toBe('delegated')
    expect(toolVerbCategory('Agent')).toBe('delegated')
  })
})

describe('FILE_TOOLS / FILE_EDIT_TOOLS', () => {
  it('FILE_TOOLS 는 편집 도구 집합 + Read 로 파생된다 (단일 진실원)', () => {
    expect([...FILE_EDIT_TOOLS].sort()).toEqual(['Edit', 'MultiEdit', 'Write'])
    for (const t of FILE_EDIT_TOOLS) expect(FILE_TOOLS.has(t)).toBe(true)
    expect(FILE_TOOLS.has('Read')).toBe(true)
    expect(FILE_TOOLS.size).toBe(FILE_EDIT_TOOLS.size + 1)
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

  it('ExitPlanMode 는 렌더 호출부가 주입한 planLabel(카탈로그 해석 결과)', () => {
    expect(toolDescription(call('ExitPlanMode', { plan: '...' }), '제안된 계획')).toBe(
      '제안된 계획'
    )
    // planLabel 미주입(비 렌더 컨텍스트)이면 도구 이름 폴백.
    expect(toolDescription(call('ExitPlanMode', { plan: '...' }))).toBe('ExitPlanMode')
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

describe('VERB_KEY / VERB_KEY_ACTIVE / UNIT_KEY (키맵 완전성)', () => {
  const cats: VerbCategory[] = [
    'ran',
    'created',
    'edited',
    'read',
    'used',
    'planned',
    'requested',
    'delegated'
  ]

  it('모든 카테고리의 완료/진행 키가 ko 카탈로그에서 해석되고 서로 다르다', () => {
    for (const c of cats) {
      const done = koLeaf(VERB_KEY[c])
      const active = koLeaf(VERB_KEY_ACTIVE[c])
      expect(done, `verb.${c}`).toBeTruthy()
      expect(active, `verbActive.${c}`).toBeTruthy()
      expect(active).not.toBe(done)
    }
    expect(koLeaf(VERB_KEY_ABORTED)).toBe('중단됨')
  })

  it('ko 표시 결과는 마이그레이션 전과 동일하다 (Claude Code 어휘)', () => {
    expect(koLeaf(VERB_KEY.ran)).toBe('실행됨')
    expect(koLeaf(VERB_KEY_ACTIVE.ran)).toBe('실행 중')
    expect(koLeaf(VERB_KEY.created)).toBe('업데이트됨')
    expect(koLeaf(VERB_KEY.edited)).toBe('수정됨')
    expect(koLeaf(VERB_KEY.read)).toBe('읽음')
    expect(koLeaf(VERB_KEY_ACTIVE.read)).toBe('읽는 중')
  })

  it('단위 plural 키(_other)가 ko 카탈로그에 존재한다 — planned 만 단위 없음', () => {
    for (const c of cats) {
      const unitKey = UNIT_KEY[c]
      if (c === 'planned') {
        expect(unitKey).toBeNull()
        continue
      }
      expect(unitKey, `unit.${c}`).toBeTruthy()
      expect(koLeaf(`${unitKey}_other`), `${unitKey}_other`).toContain('{{count}}')
    }
    expect(koLeaf(`${UNIT_KEY.ran}_other`)).toBe('명령 {{count}}개')
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

  it('카테고리별 카운트를 정해진 순서의 구조화 세그먼트로 반환한다', () => {
    const calls = [
      call('Bash', { command: 'a' }),
      call('Bash', { command: 'b' }),
      call('Bash', { command: 'c' }),
      call('Write', { file_path: 'x' }),
      call('Write', { file_path: 'y' }),
      call('Write', { file_path: 'z' })
    ]
    expect(toolGroupSegments(calls)).toEqual([
      { category: 'ran', n: 3, hasError: false },
      { category: 'created', n: 3, hasError: false }
    ])
  })

  it('Read 는 read 카테고리, Glob 등은 used', () => {
    expect(
      toolGroupSegments([call('Read', { file_path: 'a' }), call('Glob', { pattern: 'b' })])
    ).toEqual([
      { category: 'read', n: 1, hasError: false },
      { category: 'used', n: 1, hasError: false }
    ])
  })
})

describe('formatDurationLabel / formatTokenLabel', () => {
  it('소요시간 — 60초 미만은 초, 이상은 분+초 (ko 카탈로그 값 기준)', () => {
    expect(formatDurationLabel(fakeTr as never, 3_000)).toBe('3초')
    expect(formatDurationLabel(fakeTr as never, 92_000)).toBe('1분 32초')
    expect(formatDurationLabel(fakeTr as never, null)).toBeNull()
  })

  it('토큰 — 1000 이상은 k 단위 소수 1자리', () => {
    expect(formatTokenLabel(fakeTr as never, 20_600)).toBe('20.6k 토큰')
    expect(formatTokenLabel(fakeTr as never, 512)).toBe('512 토큰')
    expect(formatTokenLabel(fakeTr as never, null)).toBeNull()
  })
})
