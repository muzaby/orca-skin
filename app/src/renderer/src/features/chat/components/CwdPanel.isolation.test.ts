// Real CwdPanel/BranchChip/WorktreeToggle markup and draft callback regression.

import { describe, expect, it, vi } from 'vitest'

const { setWorktreeIsolation, setWorktreeBaseRef, sessionState, chipProps, branchProps } =
  vi.hoisted(() => ({
    setWorktreeIsolation: vi.fn(),
    setWorktreeBaseRef: vi.fn(),
    sessionState: {
      value: {
        extraDirs: [],
        extraDirRejection: null,
        worktreeIsolation: false,
        worktreeBaseRef: null as string | null
      }
    },
    chipProps: [] as Array<Record<string, unknown>>,
    branchProps: [] as Array<Record<string, unknown>>
  }))

vi.mock('../store/chatStore', () => ({
  chatActions: {
    setWorktreeIsolation,
    setWorktreeBaseRef,
    addExtraDir: vi.fn(),
    removeExtraDir: vi.fn()
  },
  useChatSession: (select: (s: unknown) => unknown) => select(sessionState.value)
}))
vi.mock('../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key })
}))
vi.mock('../../../shared/api/ipc', () => ({ fileApi: { pickDirectory: vi.fn() }, gitApi: {} }))
vi.mock('./CwdButton', () => ({ CwdButton: () => null }))
vi.mock('./composer/branchChipState', async (original) => ({
  ...(await original<typeof import('./composer/branchChipState')>()),
  statusForCwd: () => ({
    isRepo: true,
    branch: 'main',
    detached: false,
    dirty: false,
    root: '/repo'
  })
}))
vi.mock('./composer/BranchChip', async (original) => {
  const actual = await original<typeof import('./composer/BranchChip')>()
  return {
    BranchChip: (props: Record<string, unknown>) => {
      branchProps.push(props)
      return createElement(actual.BranchChip, props as never)
    }
  }
})
vi.mock('./composer/WorktreeToggle', async (original) => {
  const actual = await original<typeof import('./composer/WorktreeToggle')>()
  return {
    WorktreeToggle: (props: Record<string, unknown>) => {
      chipProps.push(props)
      return createElement(actual.WorktreeToggle, props as never)
    }
  }
})

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { CwdPanel } from './CwdPanel'
import { ko } from '../../../shared/i18n/resources/ko'
import { en } from '../../../shared/i18n/resources/en'

const markup = (
  isolation: boolean,
  inflight = false,
  cwd: string | null = '/repo',
  worktreeBaseRef: string | null = null
): string => {
  sessionState.value = {
    extraDirs: [],
    extraDirRejection: null,
    worktreeIsolation: isolation,
    worktreeBaseRef
  }
  branchProps.length = 0
  return renderToStaticMarkup(createElement(CwdPanel, { cwd, inflight }))
}

// Check only the worktree input, not the similarly disabled sibling buttons.
const isolationChip = (panelMarkup: string): string => {
  const chunk = panelMarkup.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0]
  expect(chunk, '워크트리 체크박스가 마크업에 없다').toBeDefined()
  return chunk!
}

describe('CwdPanel — 격리 칩 (AC2 · AC20)', () => {
  it('칩이 렌더되고 라벨을 단다', () => {
    expect(markup(false)).toContain('chat.composer.worktreeIsolation')
  })

  it('체크 상태가 draft 값을 따라간다', () => {
    expect(isolationChip(markup(false))).not.toContain('checked=""')
    expect(isolationChip(markup(true))).toContain('checked=""')
  })

  // 비활성 방향만 단언하면 칩이 **영구 비활성**이어도 초록이다 — 사용자는 격리를 켤 수 없는데
  // 아무도 안 본다(verify r12 D34). 두 방향을 같은 축에서 본다.
  it('inflight이면 비활성이고 cwd가 없으면 숨긴다', () => {
    expect(isolationChip(markup(false, true))).toContain('disabled=""')
    expect(markup(false, false, null)).not.toContain('type="checkbox"')
  })

  it('턴이 비진행이고 cwd 가 있으면 활성이다 — 이 방향이 없으면 영구 비활성도 초록이다', () => {
    expect(isolationChip(markup(false))).not.toContain('disabled=""')
    expect(isolationChip(markup(true))).not.toContain('disabled=""')
  })

  it('클릭은 현재 draft 를 뒤집는다', () => {
    setWorktreeIsolation.mockClear()
    chipProps.length = 0
    markup(true)

    const chip = chipProps.at(-1)
    expect(chip).toBeDefined()
    ;(chip!.onChange as (checked: boolean) => void)(false)
    expect(setWorktreeIsolation).toHaveBeenCalledWith(false)
    ;(chip!.onChange as (checked: boolean) => void)(true)
    expect(setWorktreeIsolation).toHaveBeenLastCalledWith(true)
  })
})

// AC18 · AC7 배선 — 칩이 격리 상태를 브랜치 칩까지 옮기고, 툴팁이 dirty 거부 해제(D-105)를
// 대신할 안내 문구를 갖는다.
describe('CwdPanel — 유예 배선과 안내 문구 (AC7 · AC18)', () => {
  it('격리 ON 이면 브랜치 칩이 유예 콜백을 받는다 — OFF 면 받지 않는다', () => {
    markup(true)
    expect(typeof branchProps.at(-1)?.deferTo).toBe('function')

    markup(false)
    expect(branchProps.at(-1)?.deferTo).toBeUndefined()
  })

  it('유예된 브랜치가 칩까지 내려간다', () => {
    markup(true, false, '/repo', 'feature')
    expect(branchProps.at(-1)?.deferred).toBe('feature')
    // 격리를 끄면 그 값도 내려가지 않는다 — 꺼진 상태에서 남은 라벨은 거짓말이다.
    markup(false, false, '/repo', 'feature')
    expect(branchProps.at(-1)?.deferred).toBeNull()
  })

  it('격리 칩 툴팁이 미커밋 변경 안내를 단다 (AC18)', () => {
    chipProps.length = 0
    expect(markup(false)).toContain('title="chat.composer.worktreeIsolationHelp"')
    // 키만 보면 문구가 비어도 초록이다 — 실제 리소스의 내용을 함께 본다.
    expect(ko.chat.composer.worktreeIsolationHelp).toContain('커밋되지 않은 변경')
    expect(en.chat.composer.worktreeIsolationHelp).toContain('Uncommitted changes')
  })
})
