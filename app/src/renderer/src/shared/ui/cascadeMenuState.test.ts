// 0259 AC6·AC7·AC8 · VP-09 — 계단식 메뉴 reducer · 하위 패널 좌표.
import { describe, expect, it } from 'vitest'
import {
  INITIAL_CASCADE_STATE,
  SUBMENU_EDGE,
  SUBMENU_GAP,
  reduceCascade,
  submenuPosition,
  type CascadeItem,
  type CascadeState
} from './cascadeMenuState'

type A = string
const items: CascadeItem<A>[] = [
  { kind: 'action', id: 'attach', label: 'attach', action: 'attach' },
  { kind: 'separator', id: 'sep' },
  {
    kind: 'submenu',
    id: 'skills',
    label: 'skills',
    items: [
      {
        kind: 'submenu',
        id: 'orca',
        label: 'orca',
        items: [
          { kind: 'action', id: 's1', label: 's1', action: 'skill:s1' },
          { kind: 'action', id: 's2', label: 's2', action: 'skill:s2', disabled: true },
          { kind: 'action', id: 's3', label: 's3', action: 'skill:s3' }
        ]
      }
    ]
  },
  {
    kind: 'submenu',
    id: 'plugins',
    label: 'plugins',
    items: [{ kind: 'empty', id: 'none', label: 'none' }]
  }
]

function run(
  keys: string[],
  from: CascadeState = INITIAL_CASCADE_STATE
): ReturnType<typeof reduceCascade<A>> {
  let state = from
  let effect = null as ReturnType<typeof reduceCascade<A>>['effect']
  for (const key of keys) ({ state, effect } = reduceCascade(items, state, { type: 'key', key }))
  return { state, effect }
}

describe('키보드 (AC6)', () => {
  it('↓ 로 진입하고 구분선을 건너뛰며 순환한다', () => {
    expect(run(['ArrowDown']).state.focus).toEqual({ level: 0, index: 0 })
    expect(run(['ArrowDown', 'ArrowDown']).state.focus).toEqual({ level: 0, index: 2 })
    expect(run(['ArrowDown', 'ArrowUp']).state.focus).toEqual({ level: 0, index: 3 })
  })

  it('→ 하위를 열고 첫 활성 항목으로, ← 는 하위를 닫고 부모 항목으로', () => {
    const opened = run(['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight'])
    expect(opened.state).toEqual({ open: [2, 0], focus: { level: 2, index: 0 } })
    const back = run(['ArrowLeft'], opened.state)
    expect(back.state).toEqual({ open: [2], focus: { level: 1, index: 0 } })
    expect(run(['ArrowLeft'], back.state).state).toEqual({
      open: [],
      focus: { level: 0, index: 2 }
    })
  })

  it('비활성 항목은 건너뛴다 · Enter 는 동작을 실행한다', () => {
    const deep = run(['ArrowDown', 'ArrowDown', 'Enter', 'Enter', 'ArrowDown'])
    expect(deep.state.focus).toEqual({ level: 2, index: 2 })
    expect(run(['Enter'], deep.state).effect).toEqual({ type: 'activate', action: 'skill:s3' })
  })

  it('하위 안 Esc 는 한 단계만 닫고, 최상위 Esc 는 메뉴를 닫는다', () => {
    const opened = run(['ArrowDown', 'ArrowDown', 'Enter'])
    const esc = run(['Escape'], opened.state)
    expect(esc.effect).toBeNull()
    expect(esc.state.open).toEqual([])
    expect(run(['Escape'], esc.state).effect).toEqual({ type: 'close' })
  })

  it('빈 하위(활성 항목 없음)를 열어도 포커스는 부모에 남는다', () => {
    const r = run(['ArrowDown', 'ArrowUp', 'ArrowRight'])
    expect(r.state).toEqual({ open: [3], focus: { level: 0, index: 3 } })
  })
})

describe('마우스 (AC7)', () => {
  it('하위 항목 hover 는 그 하위를 열고 형제 하위를 닫는다 · 동작 항목 hover 는 아래를 닫는다', () => {
    let { state } = reduceCascade(items, INITIAL_CASCADE_STATE, {
      type: 'hover',
      level: 0,
      index: 2
    })
    expect(state.open).toEqual([2])
    ;({ state } = reduceCascade(items, state, { type: 'hover', level: 0, index: 3 }))
    expect(state.open).toEqual([3])
    ;({ state } = reduceCascade(items, state, { type: 'hover', level: 0, index: 0 }))
    expect(state.open).toEqual([])
  })

  it('클릭: 하위는 열고, 동작은 실행, 비활성은 무시', () => {
    expect(
      reduceCascade(items, INITIAL_CASCADE_STATE, { type: 'click', level: 0, index: 0 }).effect
    ).toEqual({
      type: 'activate',
      action: 'attach'
    })
    const open = { open: [2, 0], focus: null }
    expect(reduceCascade(items, open, { type: 'click', level: 2, index: 1 }).effect).toBeNull()
  })
})

describe('submenuPosition (AC8)', () => {
  const viewport = { width: 1000, height: 600 }
  const size = { width: 200, height: 300 }
  it('기본은 부모 항목 오른쪽 4px · 위 4px', () => {
    expect(
      submenuPosition({ itemRect: { left: 100, right: 300, top: 100 }, size, viewport })
    ).toEqual({
      left: 300 + SUBMENU_GAP,
      top: 100 - SUBMENU_GAP,
      maxHeight: 600 - SUBMENU_EDGE * 2
    })
  })
  it('오른쪽이 넘치면 왼쪽으로 뒤집는다', () => {
    expect(
      submenuPosition({ itemRect: { left: 700, right: 900, top: 100 }, size, viewport }).left
    ).toBe(700 - SUBMENU_GAP - 200)
  })
  it('아래가 모자라면 위로 민다', () => {
    expect(
      submenuPosition({ itemRect: { left: 100, right: 300, top: 500 }, size, viewport }).top
    ).toBe(600 - SUBMENU_EDGE - 300)
  })
  it('화면보다 높으면 최대 높이로 자르고 위 여백에 붙인다', () => {
    const r = submenuPosition({
      itemRect: { left: 100, right: 300, top: 300 },
      size: { width: 200, height: 2000 },
      viewport
    })
    expect(r).toMatchObject({ top: SUBMENU_EDGE, maxHeight: 584 })
  })
})

describe('disabled native submenus', () => {
  const groups: CascadeItem<string>[] = [
    { kind: 'submenu', id: 'empty', label: 'MCP', disabled: true, items: [] },
    {
      kind: 'submenu',
      id: 'plugins',
      label: 'Plugins',
      items: [{ kind: 'action', id: 'plugin', label: 'Plugin', action: 'open' }]
    }
  ]
  it('skips the empty group with arrows and cannot open it with mouse or keyboard', () => {
    expect(
      reduceCascade(groups, INITIAL_CASCADE_STATE, { type: 'key', key: 'ArrowDown' }).state.focus
    ).toEqual({ level: 0, index: 1 })
    const focused = { open: [], focus: { level: 0, index: 0 } }
    for (const key of ['Enter', ' ', 'ArrowRight']) {
      const result = reduceCascade(groups, focused, { type: 'key', key })
      expect(result.state.open).toEqual([])
      expect(result.effect).toBeNull()
    }
    for (const type of ['hover', 'click'] as const) {
      expect(reduceCascade(groups, INITIAL_CASCADE_STATE, { type, level: 0, index: 0 })).toEqual({
        state: INITIAL_CASCADE_STATE,
        effect: null
      })
    }
  })
  it('opens normally once the group receives items', () => {
    const populated: CascadeItem<string>[] = [
      {
        kind: 'submenu',
        id: 'filled',
        label: 'MCP',
        disabled: false,
        items: [{ kind: 'action', id: 'server', label: 'Server', action: 'toggle' }]
      }
    ]
    expect(
      reduceCascade(populated, INITIAL_CASCADE_STATE, { type: 'click', level: 0, index: 0 }).state
        .open
    ).toEqual([0])
  })
})
