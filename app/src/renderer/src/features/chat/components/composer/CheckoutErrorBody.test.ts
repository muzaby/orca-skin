// D2 / AC9 후반절의 **마지막 홉** — 조립된 문단이 실제로 그려지는가.
//
// `checkoutErrorLines` 테스트는 조립을 잠근다. 이 파일은 그것을 **그리는 분기**를 잠근다 —
// r1 재측정에서 `line.kind === 'notice'` 분기를 무력화해도 렌더러 365케이스가 전건 통과했다.
// `CheckoutErrorBody` 는 훅이 없으므로 그대로 불러 엘리먼트 트리를 훑을 수 있다.

import { describe, expect, it } from 'vitest'
import { CheckoutErrorBody } from './CheckoutErrorBody'
import type { CheckoutErrorLine } from './branchChipState'

interface ElementLike {
  props: Record<string, unknown>
}

function flatten(node: unknown, out: ElementLike[] = []): ElementLike[] {
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out)
    return out
  }
  if (node == null || typeof node !== 'object') return out
  const element = node as Partial<ElementLike>
  if (element.props == null || typeof element.props !== 'object') return out
  out.push(element as ElementLike)
  flatten((element.props as { children?: unknown }).children, out)
  return out
}

const render = (lines: CheckoutErrorLine[]): ElementLike[] =>
  flatten(CheckoutErrorBody({ lines, translate: (key) => `tr:${key}` }))

const surfaces = (nodes: ElementLike[]): unknown[] =>
  nodes.map((n) => n.props['data-surface']).filter(Boolean)

describe('CheckoutErrorBody — 안내 문단이 실제로 그려진다', () => {
  it('notice 줄은 안내 문단으로 그려지고 문구가 해석된다', () => {
    const nodes = render([
      { kind: 'notice', messageKey: 'chat.composer.branchAppliedStash' },
      { kind: 'detail', text: 'boom' }
    ])
    const notice = nodes.find((n) => n.props['data-surface'] === 'checkout-error-notice')

    expect(notice).toBeDefined()
    expect(notice?.props.children).toBe('tr:chat.composer.branchAppliedStash')
  })

  it('안내가 오류 원문보다 먼저 그려진다 — 순서가 트리에 남는다', () => {
    const nodes = render([
      { kind: 'notice', messageKey: 'chat.composer.branchAppliedDiscard' },
      { kind: 'detail', text: 'boom' }
    ])

    expect(surfaces(nodes)).toEqual(['checkout-error-notice', 'checkout-error-detail'])
  })

  it('detail 줄은 git 원문을 그대로 싣는다', () => {
    const nodes = render([{ kind: 'detail', text: 'fatal: no such branch' }])
    const detail = nodes.find((n) => n.props['data-surface'] === 'checkout-error-detail')

    expect(detail?.props.children).toBe('fatal: no such branch')
  })

  it('빈 목록이면 아무 문단도 그리지 않는다', () => {
    expect(surfaces(render([]))).toEqual([])
  })
})
