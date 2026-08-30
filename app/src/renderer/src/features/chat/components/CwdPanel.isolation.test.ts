// AC2 · AC20 · VP-01 — 랜딩의 격리 칩이 **실제로 렌더되고**, 눌림 상태가 draft 값과 같이 움직이며,
// 클릭이 그 draft 를 뒤집는다.
//
// 이 저장소에는 DOM 테스트 하네스가 없다(`@testing-library` 0건 · vitest `environment: 'node'`).
// 그래서 이웃 `CwdPanel.landing.test.ts` 는 소스 스윕으로 대신했고, 그 스윕은 **칩을 통째로 지워도
// 초록**이다. 여기서는 이미 런타임 의존인 `react-dom/server` 로 production 컴포넌트를 실제로
// 렌더해 산출 마크업을 본다 — 새 패키지를 더하지 않는다.

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
vi.mock('../../../shared/api/ipc', () => ({ fileApi: { pickDirectory: vi.fn() } }))
// cwd·브랜치 칩은 이 계약의 대상이 아니다 — 자기 IPC 를 물지 않게 형상만 남긴다.
vi.mock('./CwdButton', () => ({ CwdButton: () => null }))
// 브랜치 칩은 자기 IPC 를 물지 않게 형상만 남기되 **받은 props 는 본다** — 격리 상태가 여기까지
// 오지 않으면 유예는 어디에서도 일어나지 않는다(EP-01 두 번째 지점).
vi.mock('./composer/BranchChip', () => ({
  BranchChip: (props: Record<string, unknown>) => {
    branchProps.push(props)
    return null
  }
}))
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

// 격리 칩 **자신의** button 조각만 떼어낸다. 패널 전체를 보면 형제 `＋` 칩도 inflight 에
// 비활성이라 `disabled=""` 가 마크업 어딘가에는 늘 있다 — 그 단언은 격리 칩이 활성으로 굳어도
// 초록이다. 라벨 문자열은 이 칩의 label 과 title 에만 나온다(`＋` 칩은 extraDirAdd).
const isolationChip = (panelMarkup: string): string => {
  const chunk = panelMarkup
    .split('<button')
    .find((part) => part.includes('chat.composer.worktreeIsolation'))
  expect(chunk, '격리 칩 button 이 마크업에 없다').toBeDefined()
  return chunk!
}

describe('CwdPanel — 격리 칩 (AC2 · AC20)', () => {
  it('칩이 렌더되고 라벨을 단다', () => {
    expect(markup(false)).toContain('chat.composer.worktreeIsolation')
  })

  it('눌림 상태가 draft 값을 따라간다 — 색이 아니라 aria-pressed 로', () => {
    expect(markup(false)).toContain('aria-pressed="false"')
    expect(markup(true)).toContain('aria-pressed="true"')
  })

  // 비활성 방향만 단언하면 칩이 **영구 비활성**이어도 초록이다 — 사용자는 격리를 켤 수 없는데
  // 아무도 안 본다(verify r12 D34). 두 방향을 같은 축에서 본다.
  it('inflight 이거나 cwd 가 없으면 비활성이다', () => {
    expect(isolationChip(markup(false, true))).toContain('disabled=""')
    expect(isolationChip(markup(false, false, null))).toContain('disabled=""')
  })

  it('턴이 비진행이고 cwd 가 있으면 활성이다 — 이 방향이 없으면 영구 비활성도 초록이다', () => {
    expect(isolationChip(markup(false))).not.toContain('disabled=""')
    expect(isolationChip(markup(true))).not.toContain('disabled=""')
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
    markup(false)
    const chip = chipProps.find((p) => p.label === 'chat.composer.worktreeIsolation')
    expect(chip?.title).toBe('chat.composer.worktreeIsolationHelp')
    // 키만 보면 문구가 비어도 초록이다 — 실제 리소스의 내용을 함께 본다.
    expect(ko.chat.composer.worktreeIsolationHelp).toContain('커밋되지 않은 변경')
    expect(en.chat.composer.worktreeIsolationHelp).toContain('Uncommitted changes')
  })
})
