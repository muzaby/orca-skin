// AC7 · AC8 · VP-03 — 격리가 켜져 있으면 브랜치 선택이 **작업 트리를 바꾸지 않는다**.
//
// 두 방향을 같은 축에서 본다. 0건 단언만 두면 칩이 아무것도 안 하도록 굳어도 초록이고, 양성
// 단언만 두면 유예 분기가 사라져도 초록이다.
//
// `CwdPanel.isolation.test.ts` 와 같은 방식으로 `react-dom/server` 로 production 컴포넌트를
// 실제 렌더한다 — 이 저장소에는 DOM 하네스가 없다.

import { describe, expect, it, vi } from 'vitest'

const { checkout, status, branches, menuProps } = vi.hoisted(() => ({
  checkout: vi.fn(async () => ({ ok: true as const, branch: 'feature' })),
  status: vi.fn(async () => ({
    isRepo: true,
    branch: 'main',
    detached: false,
    dirty: true,
    root: '/repo'
  })),
  branches: vi.fn(async () => ({ current: 'main', branches: ['main', 'feature'] })),
  menuProps: [] as Array<Record<string, unknown>>
}))

vi.mock('../../../../shared/api/ipc', () => ({ gitApi: { checkout, status, branches } }))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
// 메뉴는 팝오버 안이라 정적 마크업에 나오지 않는다 — props 만 흘려 `onPick` 을 직접 호출한다.
vi.mock('./BranchMenu', () => ({
  BranchMenu: (props: Record<string, unknown>) => {
    menuProps.push(props)
    return null
  }
}))
vi.mock('../../../../shared/ui/Popover', () => ({
  Popover: ({ children }: { children?: unknown }) => children
}))
vi.mock('../../../../shared/ui/Modal', () => ({ Modal: () => null }))
// 칩의 **가시성**만 고정한다. `react-dom/server` 는 `useEffect` 를 돌리지 않아 상태 스냅샷이
// 비고, 그러면 `branchChipView` 가 `visible:false` 로 접어 컴포넌트가 통째로 null 이 된다.
// 나머지(선택 처리·checkout 분기)는 production 코드 그대로 둔다 — 그 자리가 이 pair 의 대상이다.
vi.mock('./branchChipState', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./branchChipState')>()),
  branchChipView: () => ({ visible: true, branch: 'main' })
}))

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { BranchChip } from './BranchChip'

type Props = Parameters<typeof BranchChip>[0]

// 렌더 → 메뉴를 열어 `onPick` 을 얻는다. `useEffect` 는 SSR 에서 돌지 않으므로 첫 렌더의
// 스냅샷은 비어 있고, 칩은 그래도 그려진다(`branchChipView` 가 cwd 만으로 보이기를 정한다).
function pickFrom(props: Props): ((branch: string) => void) | null {
  menuProps.length = 0
  renderToStaticMarkup(createElement(BranchChip, props))
  const last = menuProps.at(-1)
  return (last?.onPick as ((branch: string) => void) | undefined) ?? null
}

describe('BranchChip — 격리 중 브랜치 선택은 유예된다 (AC7 · AC8)', () => {
  it('격리 ON: 선택이 checkout 을 부르지 않고 유예 콜백으로 간다 (AC7)', () => {
    checkout.mockClear()
    const deferTo = vi.fn()
    const pick = pickFrom({ cwd: '/repo', deferTo, deferred: null })

    expect(pick, '브랜치 메뉴가 렌더되지 않았다').not.toBeNull()
    pick!('feature')

    expect(checkout).not.toHaveBeenCalled()
    expect(deferTo).toHaveBeenCalledWith('feature')
  })

  it('격리 OFF: 기존대로 checkout 을 부른다 (AC8) — 이 방향이 없으면 영구 유예도 초록이다', () => {
    checkout.mockClear()
    const pick = pickFrom({ cwd: '/repo' })

    expect(pick).not.toBeNull()
    pick!('feature')

    expect(checkout).toHaveBeenCalledWith({ cwd: '/repo', branch: 'feature' })
  })

  it('유예된 값이 칩 라벨이 된다 — 눌러도 라벨이 그대로면 사용자는 무시된 것으로 읽는다', () => {
    const markup = renderToStaticMarkup(
      createElement(BranchChip, { cwd: '/repo', deferTo: vi.fn(), deferred: 'feature' })
    )
    expect(markup).toContain('feature')
  })
})
