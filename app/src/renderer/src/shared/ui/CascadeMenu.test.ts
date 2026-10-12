// 0259 r4 verify D8 · VP-02·VP-09 — CascadeMenu 가 reducer·hover 지연·submenuPosition 을 실제 이벤트에
// 잇는 자리(키 → dispatch · pointerenter/leave → 150ms 타이머 · 하위 패널 배치 호출)와, D3 — Popover 바깥
// mousedown 판정. node 환경이라 DOM 이 없으므로 react 훅만 대체하고 production 컴포넌트 함수를 그대로 부른다.
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  interface Instance {
    states: { value: unknown }[]
    refs: { current: unknown }[]
    layoutEffects: (() => void | (() => void))[]
    effects: (() => void | (() => void))[]
    stateIndex: number
    refIndex: number
  }
  const make = (): Instance => ({
    states: [],
    refs: [],
    layoutEffects: [],
    effects: [],
    stateIndex: 0,
    refIndex: 0
  })
  return { make, current: make() as Instance }
})

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) => {
      const inst = h.current
      const index = inst.stateIndex++
      if (!inst.states[index])
        inst.states[index] = {
          value: typeof initial === 'function' ? (initial as () => unknown)() : initial
        }
      const slot = inst.states[index]
      return [
        slot.value,
        (update: unknown): void => {
          slot.value =
            typeof update === 'function' ? (update as (v: unknown) => unknown)(slot.value) : update
        }
      ]
    },
    useRef: (initial: unknown) => {
      const inst = h.current
      const index = inst.refIndex++
      if (!inst.refs[index]) inst.refs[index] = { current: initial }
      return inst.refs[index]
    },
    useLayoutEffect: (run: () => void | (() => void)) => {
      h.current.layoutEffects.push(run)
    },
    useEffect: (run: () => void | (() => void)) => {
      h.current.effects.push(run)
    }
  }
})
vi.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))

import { CascadeBody } from './CascadeMenu'
import { Popover } from './Popover'
import {
  HOVER_OPEN_DELAY_MS,
  INITIAL_CASCADE_STATE,
  type CascadeItem,
  type CascadeState
} from './cascadeMenuState'

type El = ReactElement<Record<string, unknown>>
type Inst = ReturnType<typeof h.make>

const items: CascadeItem<string>[] = [
  { kind: 'action', id: 'attach', label: 'attach', action: 'attach' },
  { kind: 'separator', id: 'sep' },
  {
    kind: 'submenu',
    id: 'skills',
    label: 'skills',
    items: [{ kind: 'action', id: 's1', label: 's1', action: 'skill:s1' }]
  }
]

/** 같은 인스턴스 슬롯으로 컴포넌트 함수를 다시 부른다(재렌더). */
function call<P>(inst: Inst, component: (props: P) => unknown, props: P): El {
  h.current = inst
  inst.stateIndex = inst.refIndex = 0
  inst.layoutEffects = []
  inst.effects = []
  return component(props) as El
}

function mountBody(initialState: CascadeState = INITIAL_CASCADE_STATE): {
  inst: Inst
  render: () => El
  onSelect: ReturnType<typeof vi.fn>
  onClose: ReturnType<typeof vi.fn>
  anchorFocus: ReturnType<typeof vi.fn>
} {
  const inst = h.make()
  const onSelect = vi.fn()
  const onClose = vi.fn()
  const anchorFocus = vi.fn()
  const props = {
    items,
    onSelect,
    onClose,
    anchorRef: { current: { focus: anchorFocus } as unknown as HTMLElement },
    initialState
  }
  return {
    inst,
    render: () => call(inst, CascadeBody<string>, props),
    onSelect,
    onClose,
    anchorFocus
  }
}

const state = (inst: Inst): CascadeState => inst.states[0].value as CascadeState
const panels = (root: El): El[] => root.props.children as El[]

function keyEvent(key: string): {
  key: string
  preventDefault: ReturnType<typeof vi.fn>
  stopPropagation: ReturnType<typeof vi.fn>
} {
  return { key, preventDefault: vi.fn(), stopPropagation: vi.fn() }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    innerWidth: 1000,
    innerHeight: 800,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CascadeMenu 키 배선 (AC6 · D8 K3)', () => {
  it('메뉴 keydown 이 reducer 로 가 포커스를 옮기고, 처리한 키는 문서로 새지 않는다', () => {
    const { inst, render } = mountBody()
    const down = keyEvent('ArrowDown')
    ;(render().props.onKeyDown as (e: unknown) => void)(down)
    expect(state(inst).focus).toEqual({ level: 0, index: 0 })
    expect(down.preventDefault).toHaveBeenCalledOnce()
    expect(down.stopPropagation).toHaveBeenCalledOnce()
  })

  it('최상위 Esc 는 메뉴를 닫고 + 버튼으로 포커스를 돌린다 · 처리하지 않는 키는 무시한다', () => {
    const { inst, render, onClose, anchorFocus } = mountBody()
    const other = keyEvent('a')
    ;(render().props.onKeyDown as (e: unknown) => void)(other)
    expect(other.preventDefault).not.toHaveBeenCalled()
    expect(state(inst)).toEqual(INITIAL_CASCADE_STATE)
    ;(render().props.onKeyDown as (e: unknown) => void)(keyEvent('Escape'))
    expect(onClose).toHaveBeenCalledOnce()
    expect(anchorFocus).toHaveBeenCalledOnce()
  })
})

describe('CascadeMenu hover 지연 (AC7 · D8 H1·H2b·H3)', () => {
  it('하위 항목 hover 는 150ms 뒤에 연다 — 149ms 에는 닫혀 있다', () => {
    expect(HOVER_OPEN_DELAY_MS).toBe(150)
    const { inst, render } = mountBody()
    ;(panels(render())[0].props.onHover as (l: number, i: number) => void)(0, 2)
    vi.advanceTimersByTime(149)
    expect(state(inst).open).toEqual([])
    vi.advanceTimersByTime(1)
    expect(state(inst).open).toEqual([2])
  })

  it('150ms 전에 항목을 떠나면 열지 않는다', () => {
    const { inst, render } = mountBody()
    const panel = panels(render())[0]
    ;(panel.props.onHover as (l: number, i: number) => void)(0, 2)
    vi.advanceTimersByTime(100)
    ;(panel.props.onLeave as () => void)()
    vi.advanceTimersByTime(500)
    expect(state(inst).open).toEqual([])
  })

  it('패널 항목의 pointerenter·pointerleave 가 그 자리의 레벨·인덱스로 hover·이탈을 부른다', () => {
    const { render } = mountBody()
    const panel = panels(render())[0]
    const onHover = vi.fn()
    const onLeave = vi.fn()
    const body = call(h.make(), panel.type as (p: unknown) => unknown, {
      ...panel.props,
      onHover,
      onLeave
    })
    const rows = (body.props.children as (El | null)[]).filter(
      (row): row is El => row !== null && row.props['data-cascade-index'] !== undefined
    )
    expect(rows.map((row) => row.props['data-cascade-index'])).toEqual([0, 2])
    ;(rows[1].props.onPointerEnter as () => void)()
    expect(onHover).toHaveBeenCalledExactlyOnceWith(0, 2)
    ;(rows[1].props.onPointerLeave as () => void)()
    expect(onLeave).toHaveBeenCalledOnce()
  })
})

describe('CascadeMenu 하위 패널 배치 (AC8 · D8 P1b)', () => {
  it('열린 하위 패널은 부모 항목 좌표로 submenuPosition 을 적용한다 — 오른쪽이 넘치면 왼쪽, 아래가 모자라면 위', () => {
    const { inst, render } = mountBody({ open: [2], focus: null })
    const root = render()
    const sub = panels(root)[1]
    const parentRect = { left: 700, right: 900, top: 750, bottom: 780, width: 200, height: 30 }
    const querySelector = vi.fn(() => ({ getBoundingClientRect: () => parentRect }))
    ;(inst.refs[1] as { current: unknown }).current = { querySelector }
    const panelInst = h.make()
    call(panelInst, sub.type as (p: unknown) => unknown, sub.props)
    panelInst.refs[0].current = { offsetWidth: 200, scrollHeight: 100 }
    for (const run of panelInst.layoutEffects) run()
    expect(querySelector).toHaveBeenCalledWith('[data-cascade-level="0"][data-cascade-index="2"]')
    expect(panelInst.states[0].value).toEqual({ left: 496, top: 692, maxHeight: 784 })
    const placed = call(panelInst, sub.type as (p: unknown) => unknown, sub.props)
    expect(placed.props.style).toEqual({ left: 496, top: 692, maxHeight: 784 })
  })
})

describe('Popover 바깥 클릭 (AC7 · D3)', () => {
  it('패널 안(하위 패널 포함) mousedown 은 닫지 않고, 패널·앵커 밖 mousedown 은 닫는다', () => {
    const listeners = new Map<string, (e: unknown) => void>()
    vi.stubGlobal('document', {
      body: {},
      addEventListener: (type: string, fn: (e: unknown) => void) => listeners.set(type, fn),
      removeEventListener: vi.fn()
    })
    const onClose = vi.fn()
    const inside = { id: 'submenu-row' }
    const inst = h.make()
    const props = {
      open: true,
      anchorRef: { current: { contains: () => false } as unknown as HTMLElement },
      onClose,
      children: null
    }
    call(inst, Popover, props)
    inst.refs[0].current = { contains: (target: unknown) => target === inside }
    for (const run of inst.effects) run()
    listeners.get('mousedown')?.({ target: inside })
    expect(onClose).not.toHaveBeenCalled()
    listeners.get('mousedown')?.({ target: { id: 'outside' } })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
