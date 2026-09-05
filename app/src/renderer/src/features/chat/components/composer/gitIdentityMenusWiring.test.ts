// 0211 라운드 6 — D46 / VP-100 · VP-102 · §10 EP-74 ①②③ · D-150 · D-151 · D-152.
//
// r5 는 **훅**(`useGitIdentityRemote`)을 단독으로 돌려 조회 배선을 잠갔다. 그런데 그 훅을 부르는
// 컨테이너 `GitIdentityMenus` 를 렌더하는 테스트가 0개라 컨테이너→훅→메뉴 hop 이 그대로 열려
// 있었다 — 훅 호출 자체를 지워도(N1) · `menuEpoch` 를 `undefined` 로 굳혀도(N1b) · 조회 결과
// 대신 옛 스냅샷 주소를 메뉴에 실어도(N5) 3,352 케이스가 전부 초록이었다. 사용자에게는 메뉴가
// 영영 `확인 중` 이거나 옛 주소를 여는데 게이트가 조용했다.
//
// vitest environment 가 'node' 라 클릭·상태 전이를 돌릴 DOM 이 없다. 형제
// `gitIdentityRemoteWiring.test.ts` 와 같은 방식으로 react 훅을 대역으로 세워 **프로덕션
// 컨테이너 자신**을 돌리고, 그 컨테이너가 만든 메뉴 subtree 는 `renderToStaticMarkup` 으로
// 실제 마크업까지 가져간다(중첩 렌더 안에서는 대역 대신 실제 훅에 위임한다).
//
// 메뉴는 주소를 **본문에 적지 않는다** — `GitIdentityMenu` 는 주소를 '열기' 항목의 onClick 에만
// 싣는다. 그래서 "메뉴에 실린 주소" 는 그 항목을 눌러 `window.open` 이 받는 값으로 관측한다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { i18n } from '../../../../shared/i18n'
import type { MenuItemProps } from '../../../../shared/ui/MenuItem'

interface Slot {
  deps?: unknown[]
  value?: unknown
  cleanup?: void | (() => void)
}

const h = vi.hoisted(() => ({
  status: vi.fn(),
  open: vi.fn(),
  items: [] as MenuItemProps[],
  ssr: false,
  slots: [] as Slot[],
  cursor: 0,
  pending: [] as (() => void)[]
}))

const sameDeps = (a: unknown[] | undefined, b: unknown[]): boolean =>
  a !== undefined && a.length === b.length && a.every((dep, index) => Object.is(dep, b[index]))

// 훅 대역. `h.ssr` 인 동안은 실제 react 훅에 위임한다 — 메뉴 subtree 를 SSR 로 그릴 때
// 중첩 컴포넌트가 컨테이너의 슬롯을 밀어내면 순서가 깨진다.
vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  return {
    ...real,
    useState: (initial: unknown) => {
      if (h.ssr) return real.useState(initial as never)
      const index = h.cursor++
      const slot = (h.slots[index] ??= { value: initial })
      return [
        slot.value,
        (next: unknown) => {
          slot.value =
            typeof next === 'function' ? (next as (p: unknown) => unknown)(slot.value) : next
        }
      ]
    },
    useRef: (initial: unknown) => {
      if (h.ssr) return real.useRef(initial as never)
      const index = h.cursor++
      return (h.slots[index] ??= { value: { current: initial } }).value
    },
    useId: () => (h.ssr ? real.useId() : `menu-${h.cursor++}`),
    useMemo: (factory: () => unknown, deps: unknown[]) => {
      if (h.ssr) return real.useMemo(factory, deps)
      const index = h.cursor++
      if (!sameDeps(h.slots[index]?.deps, deps)) h.slots[index] = { deps, value: factory() }
      return h.slots[index].value
    },
    useEffect: (run: () => void | (() => void), deps: unknown[]) => {
      if (h.ssr) return real.useEffect(run, deps)
      const index = h.cursor++
      const slot = h.slots[index]
      if (sameDeps(slot?.deps, deps)) return
      h.pending.push(() => {
        slot?.cleanup?.()
        h.slots[index] = { deps, cleanup: run() }
      })
    },
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      snap: () => unknown
    ) => {
      if (h.ssr) return real.useSyncExternalStore(subscribe as never, snap as never)
      const index = h.cursor++
      const slot = (h.slots[index] ??= {})
      // 구독은 owner 당 한 번 — 재렌더가 최신 snapshot 을 읽는다.
      slot.cleanup ??= subscribe(() => {})
      return snap()
    }
  }
})
vi.mock('../../../../shared/api/ipc', () => ({ gitApi: { status: h.status } }))
// 컨테이너를 렌더 밖에서 부르므로 react-i18next 훅을 거치지 않는다. 문구는 실제 카탈로그다.
vi.mock('../../../../shared/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/i18n')>()),
  useI18n: () => ({ tr: i18n.t.bind(i18n), locale: 'ko' as const })
}))
vi.mock('../../../../shared/ui/MenuItem', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../shared/ui/MenuItem')>()
  return {
    ...original,
    MenuItem: (props: MenuItemProps) => {
      h.items.push(props)
      return createElement(original.MenuItem, props)
    }
  }
})

import { GitIdentityMenus } from './GitIdentityMenus'
import { Popover } from '../../../../shared/ui/Popover'

const FRESH = 'https://company.github.com/owner/fresh'
const STALE = 'https://github.com/owner/stale'

interface Props {
  cwd?: string | null
  repo: string | null
  branch: string | null
  detached: boolean
  githubUrl: string | null
}

const BASE: Props = { cwd: '/repo', repo: 'orca', branch: 'main', detached: false, githubUrl: null }

type Node = ReactElement & { props?: Record<string, unknown> }

function findElement(node: unknown, match: (element: Node) => boolean): Node | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child, match)
      if (hit) return hit
    }
    return null
  }
  const element = node as Node
  if (element.type !== undefined && match(element)) return element
  return findElement(element.props?.children, match)
}

/** 프로덕션 컨테이너를 한 번 그린다. 훅 슬롯이 남으므로 재호출이 리렌더다. */
function render(over: Partial<Props> = {}): Node {
  h.cursor = 0
  const tree = (GitIdentityMenus as unknown as (props: Props) => Node)({ ...BASE, ...over })
  for (const run of h.pending.splice(0)) run()
  return tree
}

const trigger = (tree: Node, kind: 'repo' | 'branch'): Node =>
  findElement(tree, (el) => el.props?.['data-git-identity-trigger'] === kind)!

const menuOf = (tree: Node): Node | null =>
  findElement(tree, (el) => typeof el.props?.['data-git-identity-menu'] === 'string')

const popoverOf = (tree: Node): Node => findElement(tree, (el) => el.type === Popover)!

/** 메뉴 subtree 만 실제 마크업으로. 같은 렌더에서 MenuItem props 도 잡는다. */
function menuMarkup(tree: Node): { html: string; items: MenuItemProps[] } {
  const menu = menuOf(tree)
  expect(menu, '컨테이너가 메뉴를 그리지 않았다').not.toBeNull()
  h.items = []
  h.ssr = true
  try {
    return { html: renderToStaticMarkup(menu as ReactElement), items: h.items }
  } finally {
    h.ssr = false
  }
}

/** '열기' 항목은 항상 마지막 MenuItem 이다(branch 는 복사 + 열기 2개). */
function openItem(items: MenuItemProps[], expected: number): MenuItemProps {
  expect(items).toHaveLength(expected)
  return items[expected - 1]
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  h.slots = []
  h.pending = []
  h.items = []
  h.cursor = 0
  h.ssr = false
  h.status.mockReset()
  h.status.mockResolvedValue({ githubUrl: FRESH })
  h.open.mockReset()
  vi.stubGlobal('window', { open: h.open })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('ko')
})

describe('메뉴 컨테이너가 조회 배선을 지난다 (D46 · VP-100·VP-102 · EP-74 ①)', () => {
  it('열지 않은 메뉴는 조회하지 않고 메뉴 본문도 없다', () => {
    const tree = render()

    expect(h.status).not.toHaveBeenCalled()
    expect(menuOf(tree)).toBeNull()
    expect(popoverOf(tree).props?.open).toBe(false)
  })

  it('메뉴를 열면 컨테이너가 건넨 cwd 로 한 번 조회한다', async () => {
    ;(trigger(render(), 'repo').props?.onClick as () => void)()
    render()
    await tick()

    expect(h.status).toHaveBeenCalledExactlyOnceWith('/repo')
  })

  it('조회가 끝나기 전에는 부재가 아니라 확인 중으로 보인다', () => {
    ;(trigger(render(), 'repo').props?.onClick as () => void)()

    const { html, items } = menuMarkup(render())

    expect(html).toContain('data-git-identity-menu="repo"')
    expect(html).toContain('원격 저장소 확인 중…')
    expect(openItem(items, 1).disabled).toBe(true)
  })
})

describe('조회 결과가 메뉴에 실린다 (D46 · EP-74 ③ · D-151)', () => {
  it('저장소 열기는 옛 스냅샷이 아니라 방금 조회한 주소를 연다', async () => {
    ;(trigger(render({ githubUrl: STALE }), 'repo').props?.onClick as () => void)()
    render({ githubUrl: STALE })
    await vi.waitFor(() => {
      expect(menuMarkup(render({ githubUrl: STALE })).html).not.toContain('원격 저장소 확인 중…')
    })

    const item = openItem(menuMarkup(render({ githubUrl: STALE })).items, 1)
    expect(item.disabled).toBe(false)
    ;(item.onClick as () => void)()

    expect(h.open).toHaveBeenCalledExactlyOnceWith(FRESH, '_blank', 'noopener,noreferrer')
  })

  it('브랜치 열기도 같은 조회 결과를 쓴다 — 형제 슬롯이 갈리지 않는다', async () => {
    ;(trigger(render({ githubUrl: STALE }), 'branch').props?.onClick as () => void)()
    render({ githubUrl: STALE })
    await vi.waitFor(() => {
      expect(menuMarkup(render({ githubUrl: STALE })).html).not.toContain('원격 저장소 확인 중…')
    })

    const { html, items } = menuMarkup(render({ githubUrl: STALE }))
    expect(html).toContain('data-git-identity-menu="branch"')
    ;(openItem(items, 2).onClick as () => void)()

    expect(h.open).toHaveBeenCalledExactlyOnceWith(
      `${FRESH}/tree/main`,
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('조회가 주소를 못 찾으면 부재 문구로 내리고 열기를 막는다 — 양성 짝의 음성 축', async () => {
    h.status.mockResolvedValue({ githubUrl: null })
    ;(trigger(render({ githubUrl: STALE }), 'repo').props?.onClick as () => void)()
    render({ githubUrl: STALE })
    await vi.waitFor(() => {
      expect(menuMarkup(render({ githubUrl: STALE })).html).toContain(
        'origin의 GitHub 주소를 확인할 수 없습니다'
      )
    })

    expect(openItem(menuMarkup(render({ githubUrl: STALE })).items, 1).disabled).toBe(true)
  })

  it('작업 경로가 없는 랜딩에서는 조회하지 않고 전달받은 주소를 연다 (D-150)', () => {
    const landing = { cwd: null, githubUrl: STALE }
    ;(trigger(render(landing), 'repo').props?.onClick as () => void)()
    ;(openItem(menuMarkup(render(landing)).items, 1).onClick as () => void)()

    expect(h.status).not.toHaveBeenCalled()
    expect(h.open).toHaveBeenCalledExactlyOnceWith(STALE, '_blank', 'noopener,noreferrer')
  })
})

describe('메뉴 수명 — 열기/닫기와 늦은 응답 (D46 · EP-74 ② · D-152)', () => {
  it('다시 누르면 닫히고, 닫았다 열어도 같은 owner 면 조회가 늘지 않는다', async () => {
    const first = render()
    ;(trigger(first, 'repo').props?.onClick as () => void)()
    const opened = render()
    await vi.waitFor(() => {
      expect(menuMarkup(render()).html).not.toContain('원격 저장소 확인 중…')
    })

    ;(trigger(opened, 'repo').props?.onClick as () => void)()
    const closed = render()
    expect(menuOf(closed)).toBeNull()
    expect(popoverOf(closed).props?.open).toBe(false)

    ;(trigger(closed, 'branch').props?.onClick as () => void)()
    const reopened = render()
    await tick()

    expect(menuOf(reopened)?.props?.['data-git-identity-menu']).toBe('branch')
    expect(h.status).toHaveBeenCalledTimes(1)
  })

  it('닫힌 메뉴의 늦은 복사 실패는 새로 연 메뉴를 덮지 않는다', () => {
    ;(trigger(render(), 'branch').props?.onClick as () => void)()
    const opened = render()
    const staleReport = findElement(opened, (el) => typeof el.props?.onCopyResult === 'function')!
      .props!.onCopyResult as (copied: boolean) => void

    // 닫고 다시 연다 — 그 사이 세대가 바뀌어 이전 메뉴의 콜백은 권한을 잃는다.
    ;(trigger(opened, 'branch').props?.onClick as () => void)()
    const closed = render()
    ;(trigger(closed, 'branch').props?.onClick as () => void)()
    render()
    staleReport(false)

    expect(menuMarkup(render()).html).not.toContain('브랜치 이름을 복사하지 못했습니다')
  })
})
