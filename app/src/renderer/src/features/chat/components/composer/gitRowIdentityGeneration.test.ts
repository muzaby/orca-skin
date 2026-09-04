// 0211 라운드 5 — D35 두 번째 축 / VP-100 · §10 EP-76 ③.
//
// 메뉴 owner 는 `GitIdentityMenus` 의 **key** 로 갈린다. 그래서 `identityGeneration` 을 상수
// `''` 로 만들어도(M8) 3,324 케이스가 초록이었다 — 턴 종료·수동 새로 고침이 원격 주소를
// 갱신하지 않는데 게이트가 조용했다.
//
// 두 hop 을 각각 잰다: ① GitRow 가 두 tick 으로 세대를 만든다 ② GitRowView 가 그 세대를
// 메뉴 owner 의 key 에 싣는다. 형제 축(요청 실행)은 `gitIdentityRemoteWiring.test.ts` 다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitStatus } from '../../../../../../shared/ipc'
import { initialChatState, type ChatState } from '../../reducer/chatReducer'

const h = vi.hoisted(() => ({ state: null as unknown as ChatState }))

vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(h.state),
  chatActions: { toggleRightPanelTile: () => {}, closeGitRow: () => {} }
}))
vi.mock('./useGitSnapshot', () => ({ useGitSnapshot: () => undefined }))
vi.mock('../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))

import { GitIdentityMenus } from './GitIdentityMenus'
import { GitRow, GitRowView } from './GitRow'
import { gitRowView } from './gitRowState'

const STATUS: GitStatus = {
  isRepo: true,
  githubUrl: 'https://company.github.com/owner/repo',
  branch: 'main',
  detached: false,
  root: '/repo'
} as GitStatus

type Element = { type?: unknown; key?: string | null; props?: Record<string, unknown> }

/** 요소 트리에서 첫 `GitIdentityMenus` 를 찾는다. */
function findMenus(node: unknown): Element | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findMenus(child)
      if (hit) return hit
    }
    return null
  }
  const element = node as Element
  if (element.type === GitIdentityMenus) return element
  return findMenus(element.props?.children)
}

/** GitRow 가 자식에게 건네는 세대를 그 컴포넌트 자신에게서 읽는다. */
function generationOf(turnEndTick: number, gitRefreshTick: number): string | undefined {
  h.state = {
    ...initialChatState,
    sessionId: 's',
    gitStatus: { cwd: '/repo', status: STATUS },
    turnEndTick,
    gitRefreshTick
  }
  const row = (GitRow as unknown as (props: { cwd: string; sessionStarted: boolean }) => Element)({
    cwd: '/repo',
    sessionStarted: true
  })
  return row.props?.identityGeneration as string | undefined
}

beforeEach(() => {
  h.state = initialChatState
})

describe('갱신 세대가 메뉴 owner 에 닿는다 (D35 · VP-100 · EP-76 ③)', () => {
  it('GitRow 가 턴 종료·수동 새로 고침 두 축으로 세대를 만든다', () => {
    const seen = [generationOf(0, 0), generationOf(1, 0), generationOf(1, 1)]

    // 두 축이 각각 세대를 움직인다 — 한 축만 읽거나 상수로 만든 변이는 여기서 red 다.
    expect(new Set(seen).size).toBe(3)
    expect(seen[0]).toContain('0')
    expect(seen[1]).not.toBe(seen[0])
    expect(seen[2]).not.toBe(seen[1])
  })

  it('세대가 그대로면 owner 도 그대로다 — 매 렌더 재조회가 되지 않는다', () => {
    expect(generationOf(2, 3)).toBe(generationOf(2, 3))
  })

  it('GitRowView 가 그 세대를 메뉴 owner 의 key 에 싣는다', () => {
    const view = gitRowView(true, '/repo', STATUS, null, null, null, 0)
    const generation = generationOf(3, 2)!
    const menus = findMenus(
      GitRowView({
        cwd: '/repo',
        identityGeneration: generation,
        view,
        diffOpen: false,
        onToggleDiff: () => {},
        onClose: () => {}
      })
    )

    expect(menus).not.toBeNull()
    expect(menus!.props?.cwd).toBe('/repo')
    // key 는 배열 JSON 이라 세대 문자열이 이스케이프돼 들어간다 — 두 tick 값이 그 안에 산다.
    expect(menus!.key).toContain('3')
    expect(menus!.key).toContain('2')
    expect(
      findMenus(
        GitRowView({
          cwd: '/repo',
          identityGeneration: generationOf(9, 9)!,
          view,
          diffOpen: false,
          onToggleDiff: () => {},
          onClose: () => {}
        })
      )!.key
    ).not.toBe(menus!.key)
  })
})
