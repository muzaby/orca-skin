// 컴포넌트 트리 실행 하네스(0259 r5 verify D9) — DOM 이 없는 node 환경에서 production 컴포넌트 함수를
// 그대로 실행하고, React 런타임(훅 · effect deps · 커밋 순서 · ref 부착/해제)과 브라우저(가짜 DOM ·
// 이벤트 버블링 · 포커스 · 문서 리스너 · requestAnimationFrame)만 흉내 낸다.
//
// 포커스는 Chromium 처럼 visibility:hidden(자기·조상 inline style) 아래 요소에서 거부된다 — Popover 와
// 하위 패널은 배치를 재기 전 첫 커밋에서 숨어 있고, 그 사이에 부른 focus() 는 Electron 에서 무시된다
// (0259 r6 Electron 실측). 커밋 순서도 React 처럼 layout effect → passive effect → (상태가 바뀌었으면)
// 재렌더다. 다른 점: 재렌더는 늘 루트부터라 React 의 bailout 이 없다 — deps 없는 effect 는 React 보다
// 자주 돈다(deps 가 있는 effect·memo 는 같은 시점에 돈다).
//
// 사용: 테스트 파일이 'react'·'react-dom' 을 이 모듈의 fakeHooks·fakeReactDom 으로 덮는다.
//   vi.mock('react', async (orig) => ({ ...(await orig()), ...(await import('…/renderHarness.testfixture')).fakeHooks }))
//   vi.mock('react-dom', async () => (await import('…/renderHarness.testfixture')).fakeReactDom)
import { vi } from 'vitest'

type Props = Record<string, unknown>
type Cleanup = void | (() => void)
type Deps = readonly unknown[] | undefined

const ELEMENT_TYPES = new Set([
  Symbol.for('react.transitional.element'),
  Symbol.for('react.element')
])
const FORWARD_REF = Symbol.for('react.forward_ref')
const MEMO = Symbol.for('react.memo')
const FRAGMENT = Symbol.for('react.fragment')
/** 마우스·focus() 로 포커스를 받는 태그(tabIndex 가 있으면 태그와 무관). */
const FOCUSABLE_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea'])
/** 한 프레임(ms) — requestAnimationFrame 은 가짜 타이머 위에서 이만큼 뒤에 돈다. */
export const FRAME_MS = 16

interface ElementLike {
  $$typeof: symbol
  type: unknown
  key: string | null
  props: Props
}

function isElement(value: unknown): value is ElementLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    ELEMENT_TYPES.has((value as { $$typeof?: symbol }).$$typeof as symbol)
  )
}

function sameDeps(a: Deps, b: Deps): boolean {
  if (a === undefined || b === undefined) return false
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
}

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** 브라우저 레이아웃 엔진 대역 — 노드의 상자와 스크롤 높이를 테스트가 정한다. */
export type Layout = (node: FakeNode) => { rect?: Rect; scrollHeight?: number } | undefined

export class FakeNode {
  props: Props = {}
  children: FakeNode[] = []
  parent: FakeNode | null = null

  constructor(
    readonly tag: string,
    private readonly dom: FakeDom,
    public text = ''
  ) {}

  /** 자기부터 문서 꼭대기까지. */
  get path(): FakeNode[] {
    const nodes: FakeNode[] = []
    for (let node: FakeNode | null = this as FakeNode; node; node = node.parent) nodes.push(node)
    return nodes
  }

  get isConnected(): boolean {
    return this.path.includes(this.dom.body)
  }

  /** 자기 또는 조상의 inline style 이 visibility:hidden 이다. */
  get hidden(): boolean {
    return this.path.some(
      (node) => (node.props.style as { visibility?: string } | undefined)?.visibility === 'hidden'
    )
  }

  get focusable(): boolean {
    if (this.props.tabIndex !== undefined) return true
    return FOCUSABLE_TAGS.has(this.tag) && !this.props.disabled
  }

  focus(): void {
    if (!this.isConnected || !this.focusable || this.hidden) return
    this.dom.focusNode(this)
  }

  contains(other: unknown): boolean {
    for (let node = other as FakeNode | null; node; node = node.parent)
      if (node === this) return true
    return false
  }

  getAttribute(name: string): string | null {
    const prop = name === 'class' ? 'className' : name === 'tabindex' ? 'tabIndex' : name
    const value = this.props[prop]
    if (value === undefined || value === null) return null
    // React 는 aria-* 불리언을 "true"/"false" 로, 그 밖의 불리언 속성은 있음/없음으로 그린다.
    if (typeof value === 'boolean' && !name.startsWith('aria-')) return value ? '' : null
    return String(value)
  }

  /** `[name="value"]` 를 이어 붙인 선택자만 지원한다. 자손만 찾는다(자기 제외). */
  querySelectorAll(selector: string): FakeNode[] {
    const wanted = [...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].map(
      ([, name, value]) => ({ name, value })
    )
    if (wanted.length === 0) throw new Error(`unsupported selector: ${selector}`)
    const found: FakeNode[] = []
    const visit = (node: FakeNode): void => {
      for (const child of node.children) {
        const match = wanted.every(({ name, value }) => {
          const actual = child.getAttribute(name)
          return value === undefined ? actual !== null : actual === value
        })
        if (match) found.push(child)
        visit(child)
      }
    }
    visit(this)
    return found
  }

  querySelector(selector: string): FakeNode | null {
    return this.querySelectorAll(selector)[0] ?? null
  }

  /** 실패 메시지용 요약 — 부모·자식·dom 순환 구조를 통째로 찍지 않는다(pretty-format 은 toJSON 을 쓴다). */
  toJSON(): string {
    const attrs = ['id', 'role', 'aria-label', 'data-cascade-level', 'data-cascade-index']
      .map((name) => [name, this.getAttribute(name)] as const)
      .filter(([, value]) => value !== null)
      .map(([name, value]) => ` ${name}="${value}"`)
      .join('')
    return `<${this.tag}${attrs}>${this.tag === '#text' ? this.text : ''}`
  }

  get textContent(): string {
    return this.tag === '#text' ? this.text : this.children.map((c) => c.textContent).join('')
  }

  getBoundingClientRect(): Rect & { right: number; bottom: number; x: number; y: number } {
    const rect = this.dom.layout(this)?.rect ?? { left: 0, top: 0, width: 0, height: 0 }
    return {
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top
    }
  }

  get offsetWidth(): number {
    return this.dom.layout(this)?.rect?.width ?? 0
  }

  get offsetHeight(): number {
    return this.dom.layout(this)?.rect?.height ?? 0
  }

  get scrollHeight(): number {
    const box = this.dom.layout(this)
    return box?.scrollHeight ?? box?.rect?.height ?? 0
  }
}

interface EffectHook {
  deps: Deps
  cleanup: Cleanup
}

interface PendingEffect {
  hooks: EffectHook[]
  index: number
  run: () => Cleanup
  deps: Deps
}

interface Instance {
  states: { value: unknown; set: (update: unknown) => void }[]
  refs: { current: unknown }[]
  memos: { value: unknown; deps: Deps }[]
  layoutHooks: EffectHook[]
  effectHooks: EffectHook[]
  cursor: { state: number; ref: number; memo: number; layout: number; effect: number }
  pendingLayout: PendingEffect[]
  pendingEffects: PendingEffect[]
}

let rendering: { dom: FakeDom; inst: Instance } | null = null

function currentInstance(hook: string): { dom: FakeDom; inst: Instance } {
  if (!rendering) throw new Error(`${hook} called outside a harness render`)
  return rendering
}

function queueEffect(kind: 'layout' | 'effect', run: () => Cleanup, deps: Deps): void {
  const { inst } = currentInstance(kind === 'layout' ? 'useLayoutEffect' : 'useEffect')
  const hooks = kind === 'layout' ? inst.layoutHooks : inst.effectHooks
  const index = inst.cursor[kind]++
  const previous = hooks[index]
  if (previous && sameDeps(previous.deps, deps)) return
  const pending = { hooks, index, run, deps }
  if (kind === 'layout') inst.pendingLayout.push(pending)
  else inst.pendingEffects.push(pending)
}

/** 'react' 를 덮을 훅 — 슬롯은 호출 순서, effect 는 deps 가 바뀐 커밋에서만 다시 돈다. */
export const fakeHooks = {
  useState(initial: unknown): [unknown, (update: unknown) => void] {
    const { dom, inst } = currentInstance('useState')
    const index = inst.cursor.state++
    if (!inst.states[index]) {
      const slot = {
        value: typeof initial === 'function' ? (initial as () => unknown)() : initial,
        set: (update: unknown): void => {
          const next =
            typeof update === 'function' ? (update as (v: unknown) => unknown)(slot.value) : update
          if (Object.is(next, slot.value)) return
          slot.value = next
          dom.markDirty()
        }
      }
      inst.states[index] = slot
    }
    const slot = inst.states[index]
    return [slot.value, slot.set]
  },
  useRef(initial: unknown): { current: unknown } {
    const { inst } = currentInstance('useRef')
    const index = inst.cursor.ref++
    if (!inst.refs[index]) inst.refs[index] = { current: initial }
    return inst.refs[index]
  },
  useMemo(calculate: () => unknown, deps: Deps): unknown {
    const { inst } = currentInstance('useMemo')
    const index = inst.cursor.memo++
    const previous = inst.memos[index]
    if (!previous || !sameDeps(previous.deps, deps))
      inst.memos[index] = { value: calculate(), deps }
    return inst.memos[index].value
  },
  useCallback(callback: unknown, deps: Deps): unknown {
    return fakeHooks.useMemo(() => callback, deps)
  },
  useLayoutEffect(run: () => Cleanup, deps?: Deps): void {
    queueEffect('layout', run, deps)
  },
  useEffect(run: () => Cleanup, deps?: Deps): void {
    queueEffect('effect', run, deps)
  }
}

/** 'react-dom' 대역 — 포털은 그 자리에 그린다(이벤트는 React 트리를 따라 버블링하므로 같은 경로다). */
export const fakeReactDom = {
  createPortal: (node: unknown): unknown => node
}

export interface FakeEvent {
  type: string
  key?: string
  target: FakeNode
  currentTarget: FakeNode | null
  defaultPrevented: boolean
  propagationStopped: boolean
  preventDefault: () => void
  stopPropagation: () => void
}

function makeEvent(type: string, target: FakeNode, extra: { key?: string } = {}): FakeEvent {
  const event: FakeEvent = {
    type,
    ...extra,
    target,
    currentTarget: null,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault: () => {
      event.defaultPrevented = true
    },
    stopPropagation: () => {
      event.propagationStopped = true
    }
  }
  return event
}

export class FakeDom {
  readonly body: FakeNode
  readonly container: FakeNode
  readonly documentListeners = new Map<string, Set<(event: unknown) => void>>()
  private active: FakeNode | null = null
  private element: unknown = null
  private dirty = false
  private readonly instances = new Map<string, Instance>()
  private readonly nodes = new Map<string, FakeNode>()
  private readonly typeIds = new Map<unknown, number>()
  private hoverChain: FakeNode[] = []

  constructor(readonly layout: Layout) {
    this.body = new FakeNode('body', this)
    this.container = this.createNode('div', { id: 'root' })
  }

  get activeElement(): FakeNode {
    return this.active?.isConnected ? this.active : this.body
  }

  focusNode(node: FakeNode): void {
    this.active = node
  }

  markDirty(): void {
    this.dirty = true
  }

  /** 렌더 트리 밖(문서 body 바로 아래)의 노드 — 앵커·바깥 클릭 대상. */
  createNode(tag: string, props: Props = {}): FakeNode {
    const node = new FakeNode(tag, this)
    node.props = props
    node.parent = this.body
    this.body.children.push(node)
    return node
  }

  query(selector: string): FakeNode | null {
    return this.body.querySelector(selector)
  }

  queryAll(selector: string): FakeNode[] {
    return this.body.querySelectorAll(selector)
  }

  render(element: unknown): void {
    this.element = element
    this.dirty = true
    this.flush()
  }

  unmount(): void {
    this.render(null)
  }

  /** 이벤트 처리기·타이머 뒤 React 가 하듯 바뀐 상태를 다시 그리고 effect 를 돌린다. */
  act(run: () => void): void {
    run()
    this.flush()
  }

  advance(ms: number): void {
    this.act(() => vi.advanceTimersByTime(ms))
  }

  /** 다음 프레임 — requestAnimationFrame 콜백이 돈다. */
  frame(): void {
    this.advance(FRAME_MS)
  }

  /** 포커스된 요소에서 keydown — React 처리기를 거쳐 버블링하고, 막히지 않으면 문서 리스너로 간다. */
  keyDown(key: string): FakeEvent {
    const target = this.activeElement
    const event = makeEvent('keydown', target, { key })
    this.act(() => {
      this.dispatch('onKeyDown', target, event)
      if (!event.propagationStopped) this.dispatchDocument('keydown', event)
    })
    return event
  }

  /** 사람이 키를 누르고 다음 키 전에 한 프레임이 지난다. */
  key(key: string): FakeEvent {
    const event = this.keyDown(key)
    this.frame()
    return event
  }

  /** 문서 mousedown(Popover 바깥 판정) → 포커스 가능한 대상이면 포커스 → click 버블링 → 한 프레임. */
  click(target: FakeNode): void {
    this.act(() => {
      this.dispatchDocument('mousedown', makeEvent('mousedown', target))
      if (target.props.disabled) return
      if (target.isConnected && target.focusable) target.focus()
      this.dispatch('onClick', target, makeEvent('click', target))
    })
    this.frame()
  }

  mouseDown(target: FakeNode): void {
    this.act(() => this.dispatchDocument('mousedown', makeEvent('mousedown', target)))
  }

  /** 포인터를 target 으로 옮긴다 — 떠난 요소에 pointerleave(안쪽부터), 새로 든 요소에 pointerenter(바깥부터). */
  pointerTo(target: FakeNode | null): void {
    const next: FakeNode[] = []
    for (let node = target; node; node = node.parent) next.push(node)
    this.act(() => {
      for (const node of this.hoverChain)
        if (node.isConnected && !next.includes(node))
          (node.props.onPointerLeave as ((e: FakeEvent) => void) | undefined)?.(
            makeEvent('pointerleave', node)
          )
      for (const node of [...next].reverse())
        if (!this.hoverChain.includes(node))
          (node.props.onPointerEnter as ((e: FakeEvent) => void) | undefined)?.(
            makeEvent('pointerenter', node)
          )
      this.hoverChain = next
    })
  }

  private dispatch(handler: string, target: FakeNode, event: FakeEvent): void {
    for (let node: FakeNode | null = target; node; node = node.parent) {
      const fn = node.props[handler] as ((e: FakeEvent) => void) | undefined
      if (!fn) continue
      event.currentTarget = node
      fn(event)
      if (event.propagationStopped) return
    }
  }

  private dispatchDocument(type: string, event: FakeEvent): void {
    for (const listener of [...(this.documentListeners.get(type) ?? [])]) listener(event)
  }

  private flush(): void {
    for (let pass = 0; this.dirty; pass++) {
      if (pass > 50) throw new Error('render loop did not settle')
      this.dirty = false
      this.renderRoot()
    }
  }

  private renderRoot(): void {
    const visitedInstances = new Set<string>()
    const visitedNodes = new Set<string>()
    const committed: Instance[] = []
    this.container.children = []
    this.renderChild(this.element, 'r', this.container, {
      visitedInstances,
      visitedNodes,
      committed
    })

    for (const [key, node] of this.nodes)
      if (!visitedNodes.has(key)) {
        this.detachRef(node, node.props.ref)
        node.parent = null
        this.nodes.delete(key)
      }
    for (const [key, inst] of this.instances)
      if (!visitedInstances.has(key)) {
        for (const hook of [...inst.layoutHooks, ...inst.effectHooks])
          if (typeof hook?.cleanup === 'function') hook.cleanup()
        this.instances.delete(key)
      }

    // 커밋 — 자식 먼저(committed 순서). layout 정리 → layout 실행 → passive 정리 → passive 실행.
    const layout = committed.flatMap((inst) => inst.pendingLayout)
    const passive = committed.flatMap((inst) => inst.pendingEffects)
    for (const phase of [layout, passive]) {
      for (const { hooks, index } of phase) {
        const cleanup = hooks[index]?.cleanup
        if (typeof cleanup === 'function') cleanup()
      }
      for (const { hooks, index, run, deps } of phase) hooks[index] = { deps, cleanup: run() }
    }
  }

  private renderChild(
    value: unknown,
    path: string,
    parent: FakeNode,
    pass: { visitedInstances: Set<string>; visitedNodes: Set<string>; committed: Instance[] }
  ): void {
    if (value === null || value === undefined || typeof value === 'boolean') return
    if (typeof value === 'string' || typeof value === 'number') {
      this.hostNode('#text', `${path}#`, parent, pass).text = String(value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((child, index) =>
        this.renderChild(
          child,
          `${path}.${isElement(child) && child.key !== null ? `k:${child.key}` : index}`,
          parent,
          pass
        )
      )
      return
    }
    if (!isElement(value)) throw new Error(`unsupported child: ${String(value)}`)
    const { type, props } = value
    if (type === FRAGMENT) {
      this.renderChild(props.children, `${path}.f`, parent, pass)
      return
    }
    if (typeof type === 'string') {
      const node = this.hostNode(type, `${path}:${type}`, parent, pass)
      const previousRef = node.props.ref
      node.props = props
      if (previousRef !== props.ref) this.detachRef(node, previousRef)
      this.attachRef(node, props.ref)
      node.children = []
      this.renderChild(props.children, `${path}:${type}/`, node, pass)
      return
    }
    const typed = type as { $$typeof?: symbol; render?: unknown; type?: unknown }
    if (typed.$$typeof === MEMO) {
      this.renderChild({ ...value, type: typed.type }, path, parent, pass)
      return
    }
    let render: (p: Props) => unknown
    if (typeof type === 'function') render = (p) => (type as (p: Props) => unknown)(p)
    else if (typed.$$typeof === FORWARD_REF) {
      const forward = typed.render as (p: Props, ref: unknown) => unknown
      render = (p) => {
        const { ref, ...rest } = p
        return forward(rest, ref ?? null)
      }
    } else throw new Error('unsupported element type')

    if (!this.typeIds.has(type)) this.typeIds.set(type, this.typeIds.size)
    const key = `${path}<${this.typeIds.get(type)}>`
    let inst = this.instances.get(key)
    if (!inst) {
      inst = {
        states: [],
        refs: [],
        memos: [],
        layoutHooks: [],
        effectHooks: [],
        cursor: { state: 0, ref: 0, memo: 0, layout: 0, effect: 0 },
        pendingLayout: [],
        pendingEffects: []
      }
      this.instances.set(key, inst)
    }
    pass.visitedInstances.add(key)
    inst.cursor = { state: 0, ref: 0, memo: 0, layout: 0, effect: 0 }
    inst.pendingLayout = []
    inst.pendingEffects = []
    const previous = rendering
    rendering = { dom: this, inst }
    let output: unknown
    try {
      output = render(props)
    } finally {
      rendering = previous
    }
    this.renderChild(output, `${key}/`, parent, pass)
    pass.committed.push(inst)
  }

  private hostNode(
    tag: string,
    key: string,
    parent: FakeNode,
    pass: { visitedNodes: Set<string> }
  ): FakeNode {
    let node = this.nodes.get(key)
    if (!node || node.tag !== tag) {
      node = new FakeNode(tag, this)
      this.nodes.set(key, node)
    }
    pass.visitedNodes.add(key)
    node.parent = parent
    parent.children.push(node)
    return node
  }

  private attachRef(node: FakeNode, ref: unknown): void {
    if (typeof ref === 'function') ref(node)
    else if (ref && typeof ref === 'object') (ref as { current: unknown }).current = node
  }

  private detachRef(node: FakeNode, ref: unknown): void {
    if (typeof ref === 'function') ref(null)
    else if (ref && typeof ref === 'object' && (ref as { current: unknown }).current === node)
      (ref as { current: unknown }).current = null
  }
}

/**
 * 가짜 document·window 를 전역에 설치한다. 호출 전에 vi.useFakeTimers() 를 켜고,
 * afterEach 에서 vi.unstubAllGlobals() · vi.useRealTimers() 로 되돌린다.
 */
export function installFakeDom(options: {
  innerWidth: number
  innerHeight: number
  layout?: Layout
}): FakeDom {
  const dom = new FakeDom(options.layout ?? (() => undefined))
  const listeners = dom.documentListeners
  vi.stubGlobal('document', {
    body: dom.body,
    get activeElement() {
      return dom.activeElement
    },
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(fn)
    },
    removeEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners.get(type)?.delete(fn)
    }
  })
  vi.stubGlobal('window', {
    innerWidth: options.innerWidth,
    innerHeight: options.innerHeight,
    setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    requestAnimationFrame: (fn: (time: number) => void) =>
      setTimeout(() => fn(Date.now()), FRAME_MS),
    cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
  return dom
}
