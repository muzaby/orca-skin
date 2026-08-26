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
