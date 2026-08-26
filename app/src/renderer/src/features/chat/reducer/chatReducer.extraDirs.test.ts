// 컴포저 참조 경로(CLI `/add-dir` 대응)의 리듀서 계약 — AC15.
//
// 세 규칙이 전부 리듀서에 있다: cwd 를 바꾸면 비운다 · 중복은 무시한다 · cwd 자기 자신은
// 담지 않는다. 앞의 둘이 없으면 사용자가 폴더를 옮긴 뒤에도 옛 참조 경로가 그대로 세션에
// 고정되고, 마지막이 없으면 가드 루트에 같은 경로가 두 번 올라간다.

import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

const withCwd = (cwd: string | null, extraDirs: string[] = []): ChatState => ({
  ...initialChatState,
  cwd,
  extraDirs
})

describe('chatReducer — ADD_EXTRA_DIR', () => {
  it('참조 경로를 순서대로 쌓는다', () => {
    let state = withCwd('/repo')
    state = chatReducer(state, { type: 'ADD_EXTRA_DIR', dir: '/refs/a' })
    state = chatReducer(state, { type: 'ADD_EXTRA_DIR', dir: '/refs/b' })

    expect(state.extraDirs).toEqual(['/refs/a', '/refs/b'])
  })

  it('같은 경로를 두 번 담아도 길이가 1이다', () => {
    let state = withCwd('/repo')
    state = chatReducer(state, { type: 'ADD_EXTRA_DIR', dir: '/refs/a' })
    const before = state
    state = chatReducer(state, { type: 'ADD_EXTRA_DIR', dir: '/refs/a' })

    expect(state.extraDirs).toEqual(['/refs/a'])
    // 상태가 통째로 그대로여야 한다 — 새 배열을 만들면 소비처가 헛리렌더한다.
    expect(state).toBe(before)
  })

  it('cwd 자기 자신은 담지 않는다 — 가드 루트에 같은 경로가 두 번 오르지 않는다', () => {
    const state = chatReducer(withCwd('/repo'), { type: 'ADD_EXTRA_DIR', dir: '/repo' })

    expect(state.extraDirs).toEqual([])
  })
})

describe('chatReducer — REMOVE_EXTRA_DIR', () => {
  it('해당 경로만 뺀다', () => {
    const state = chatReducer(withCwd('/repo', ['/refs/a', '/refs/b']), {
      type: 'REMOVE_EXTRA_DIR',
      dir: '/refs/a'
    })

    expect(state.extraDirs).toEqual(['/refs/b'])
  })

  it('없는 경로를 빼면 상태가 그대로다', () => {
    const before = withCwd('/repo', ['/refs/a'])
    expect(chatReducer(before, { type: 'REMOVE_EXTRA_DIR', dir: '/nope' })).toBe(before)
  })
})

describe('chatReducer — SET_CWD 는 참조 경로를 비운다', () => {
  it('작업 경로를 옮기면 옛 참조 경로가 따라가지 않는다', () => {
    const state = chatReducer(withCwd('/repo', ['/refs/a', '/refs/b']), {
      type: 'SET_CWD',
      cwd: '/other'
    })

    expect(state.cwd).toBe('/other')
    expect(state.extraDirs).toEqual([])
  })
})

describe('초기 상태', () => {
  it('참조 경로는 비어 있다', () => {
    expect(initialChatState.extraDirs).toEqual([])
  })
})

// D-020 / AC25 — 루트를 고르면 칩이 붙지 않고 **사유가 남는다**. 중복·cwd 자기 자신의 조용한
// 무시와 다른 점이 이것이다: 사용자가 고른 폴더가 사라졌는데 아무 말도 없으면 앱이 먹은 것으로
// 읽힌다. 사유를 리듀서 상태로 둔 덕분에 렌더 하네스 없이 순수 단언으로 잠긴다.
describe('chatReducer — 루트 참조 경로 거부 (AC25)', () => {
  it.each(['/', 'C:\\', '\\\\srv\\share'])('%s 는 칩이 붙지 않고 사유가 남는다', (root) => {
    const state = chatReducer(withCwd('/repo'), { type: 'ADD_EXTRA_DIR', dir: root })

    expect(state.extraDirs).toEqual([])
    expect(state.extraDirRejection).toBe('root')
  })

  it('루트 밑의 실제 폴더는 계속 붙는다 — 범위 정책이 아니다', () => {
    const state = chatReducer(withCwd('/repo'), { type: 'ADD_EXTRA_DIR', dir: '/etc' })

    expect(state.extraDirs).toEqual(['/etc'])
    expect(state.extraDirRejection).toBeNull()
  })

  it('중복·cwd 자기 자신은 사유를 남기지 않는다 — 조용한 무시가 맞는 경우', () => {
    const seeded = chatReducer(withCwd('/repo'), { type: 'ADD_EXTRA_DIR', dir: '/refs/a' })

    expect(
      chatReducer(seeded, { type: 'ADD_EXTRA_DIR', dir: '/refs/a' }).extraDirRejection
    ).toBeNull()
    expect(
      chatReducer(seeded, { type: 'ADD_EXTRA_DIR', dir: '/repo' }).extraDirRejection
    ).toBeNull()
  })

  it('다음 성공 추가·제거·작업 경로 변경이 사유를 지운다', () => {
    const rejected = chatReducer(withCwd('/repo', ['/refs/a']), { type: 'ADD_EXTRA_DIR', dir: '/' })
    expect(rejected.extraDirRejection).toBe('root')

    expect(
      chatReducer(rejected, { type: 'ADD_EXTRA_DIR', dir: '/refs/b' }).extraDirRejection
    ).toBeNull()
    expect(
      chatReducer(rejected, { type: 'REMOVE_EXTRA_DIR', dir: '/refs/a' }).extraDirRejection
    ).toBeNull()
    expect(chatReducer(rejected, { type: 'SET_CWD', cwd: '/other' }).extraDirRejection).toBeNull()
  })

  it('초기 상태에는 거부 사유가 없다', () => {
    expect(initialChatState.extraDirRejection).toBeNull()
  })
})

// D-019 확장 — cwd 도 같은 축이다. `writeRoots[0]` 이라 오히려 더 직접적이다.
describe('chatReducer — 루트 작업 경로 거부 (AC25 · cwd 축)', () => {
  it.each(['/', 'C:\\', '\\\\srv\\share'])('%s 는 cwd 가 되지 않고 사유가 남는다', (root) => {
    const before = withCwd('/repo', ['/refs/a'])
    const state = chatReducer(before, { type: 'SET_CWD', cwd: root })

    expect(state.cwd).toBe('/repo')
    expect(state.extraDirRejection).toBe('root')
  })

  it('거부된 SET_CWD 는 참조 경로를 비우지 않는다 — cwd 가 안 바뀌었으므로', () => {
    const state = chatReducer(withCwd('/repo', ['/refs/a', '/refs/b']), {
      type: 'SET_CWD',
      cwd: '/'
    })

    expect(state.extraDirs).toEqual(['/refs/a', '/refs/b'])
  })

  it('루트가 아닌 경로는 계속 cwd 가 된다 — 범위 정책이 아니다', () => {
    const state = chatReducer(withCwd('/repo'), { type: 'SET_CWD', cwd: '/etc' })

    expect(state.cwd).toBe('/etc')
    expect(state.extraDirRejection).toBeNull()
  })

  it('두 선택창이 같은 사유 상태를 공유한다 — 규칙이 하나라 문장도 하나다', () => {
    const byChip = chatReducer(withCwd('/repo'), { type: 'ADD_EXTRA_DIR', dir: '/' })
    const byCwd = chatReducer(withCwd('/repo'), { type: 'SET_CWD', cwd: '/' })

    expect(byChip.extraDirRejection).toBe(byCwd.extraDirRejection)
  })
})
