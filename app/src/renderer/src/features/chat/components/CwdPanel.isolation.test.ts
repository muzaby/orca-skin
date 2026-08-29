// AC2 · AC20 · VP-01 — 랜딩의 격리 칩이 **실제로 렌더되고**, 눌림 상태가 draft 값과 같이 움직이며,
// 클릭이 그 draft 를 뒤집는다.
//
// 이 저장소에는 DOM 테스트 하네스가 없다(`@testing-library` 0건 · vitest `environment: 'node'`).
// 그래서 이웃 `CwdPanel.landing.test.ts` 는 소스 스윕으로 대신했고, 그 스윕은 **칩을 통째로 지워도
// 초록**이다. 여기서는 이미 런타임 의존인 `react-dom/server` 로 production 컴포넌트를 실제로
// 렌더해 산출 마크업을 본다 — 새 패키지를 더하지 않는다.

import { describe, expect, it, vi } from 'vitest'

const { setWorktreeIsolation, sessionState, chipProps } = vi.hoisted(() => ({
  setWorktreeIsolation: vi.fn(),
  sessionState: { value: { extraDirs: [], extraDirRejection: null, worktreeIsolation: false } },
  chipProps: [] as Array<Record<string, unknown>>
}))

vi.mock('../store/chatStore', () => ({
  chatActions: { setWorktreeIsolation, addExtraDir: vi.fn(), removeExtraDir: vi.fn() },
  useChatSession: (select: (s: unknown) => unknown) => select(sessionState.value)
}))
vi.mock('../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key })
}))
vi.mock('../../../shared/api/ipc', () => ({ fileApi: { pickDirectory: vi.fn() } }))
// cwd·브랜치 칩은 이 계약의 대상이 아니다 — 자기 IPC 를 물지 않게 형상만 남긴다.
vi.mock('./CwdButton', () => ({ CwdButton: () => null }))
vi.mock('./composer/BranchChip', () => ({ BranchChip: () => null }))
// 진짜 칩을 그대로 렌더하되 props 만 흘려 본다 — 마크업 단언은 production 컴포넌트가 만든다.
vi.mock('./composer/ComposerChip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./composer/ComposerChip')>()
  return {
    ComposerChip: (props: Record<string, unknown>) => {
      chipProps.push(props)
      // forwardRef 컴포넌트라 직접 호출할 수 없다 — element 로 만들어 그대로 렌더시킨다.
      return createElement(actual.ComposerChip, props as never)
    }
  }
})

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { CwdPanel } from './CwdPanel'

const markup = (isolation: boolean, inflight = false): string => {
  sessionState.value = { extraDirs: [], extraDirRejection: null, worktreeIsolation: isolation }
  return renderToStaticMarkup(createElement(CwdPanel, { cwd: '/repo', inflight }))
}

describe('CwdPanel — 격리 칩 (AC2 · AC20)', () => {
  it('칩이 렌더되고 라벨을 단다', () => {
    expect(markup(false)).toContain('chat.composer.worktreeIsolation')
  })

  it('눌림 상태가 draft 값을 따라간다 — 색이 아니라 aria-pressed 로', () => {
    expect(markup(false)).toContain('aria-pressed="false"')
    expect(markup(true)).toContain('aria-pressed="true"')
  })

  it('inflight 이거나 cwd 가 없으면 비활성이다', () => {
    expect(markup(false, true)).toContain('disabled=""')
    sessionState.value = { extraDirs: [], extraDirRejection: null, worktreeIsolation: false }
    expect(renderToStaticMarkup(createElement(CwdPanel, { cwd: null, inflight: false }))).toContain(
      'disabled=""'
    )
  })

  it('클릭은 현재 draft 를 뒤집는다', () => {
    setWorktreeIsolation.mockClear()
    chipProps.length = 0
    markup(true)

    const chip = chipProps.find((p) => p.label === 'chat.composer.worktreeIsolation')
    expect(chip).toBeDefined()
    ;(chip!.onClick as () => void)()
    expect(setWorktreeIsolation).toHaveBeenCalledWith(false)
  })
})
