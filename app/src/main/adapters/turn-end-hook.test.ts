// 0211 ΔV6 AT-71 / VP-72 — 턴 종료 신호가 **Stop hook 에서 시작한다** (D-115 · §10 EP-46 ①).
//
// 두 축을 함께 잰다.
//   ① **등록** — 어댑터가 `Stop` 매처를 실제로 붙이는가. 붙이지 않으면 조용히 0회 싱크다.
//   ② **비동기** — 콜백이 조회를 기다리지 않는가. "`async` 가 아니다" 같은 구조 단언은
//      안에서 `void gitQuery()` 를 부르는 구현을 막지 못하므로, 핸들러 안에서 어떤 부작용도
//      일어나지 않았다(주입한 sink 호출 0)와 신호 +1 을 **함께** 센다.

import { describe, expect, it } from 'vitest'
import { makeTurnEndHook, mergeHooks } from './claude-adapt'

type Matcher = { hooks: ((input: unknown, toolUseId: unknown, opts: unknown) => unknown)[] }
type Fragment = { hooks?: Record<string, Matcher[]> }

const callbackOf = (fragment: object): ((i: unknown, t: unknown, o: unknown) => unknown) => {
  const stop = (fragment as Fragment).hooks?.Stop
  expect(stop).toHaveLength(1)
  return stop![0].hooks[0]
}

describe('Stop hook 조각 (AT-71 · D-115)', () => {
  it('`Stop` 이벤트에 매처 하나를 등록한다 — 다른 이벤트는 건드리지 않는다', () => {
    const fragment = makeTurnEndHook(() => undefined) as Fragment

    expect(Object.keys(fragment.hooks ?? {})).toEqual(['Stop'])
    expect(fragment.hooks?.Stop).toHaveLength(1)
  })

  it('신호를 **동기적으로** 올리고 첫 마이크로태스크에 빈 결정으로 끝난다', async () => {
    let signals = 0
    const pending = callbackOf(makeTurnEndHook(() => (signals += 1)))({}, undefined, {})

    // ① 동기 — `await` 하기 전에 이미 올랐다. 콜백 안에서 무언가를 `await` 한 구현이면
    //    신호가 이 시점에 아직 0 이다.
    expect(signals).toBe(1)

    // ② 첫 마이크로태스크 — 나란히 만든 이 promise 보다 늦지 않는다. 안에서 조회를
    //    기다리는 구현이면 순서가 뒤집혀 `['probe', 'hook']` 이 된다.
    const order: string[] = []
    await Promise.all([
      Promise.resolve(pending).then(() => order.push('hook')),
      Promise.resolve().then(() => order.push('probe'))
    ])

    expect(order).toEqual(['hook', 'probe'])
    await expect(pending).resolves.toEqual({})
  })

  it('턴마다 신호가 하나씩 쌓인다 — 두 번 발화하면 둘이다', async () => {
    let signals = 0
    const cb = callbackOf(makeTurnEndHook(() => (signals += 1)))

    await cb({}, undefined, {})
    await cb({}, undefined, {})

    expect(signals).toBe(2)
  })

  it('다른 조각과 병합해도 `Stop` 매처가 살아남는다 (§10 EP-46 ①)', () => {
    const merged = mergeHooks(
      { hooks: { PreToolUse: [{ hooks: [] }] } },
      makeTurnEndHook(() => undefined)
    ) as Fragment

    expect(Object.keys(merged.hooks ?? {}).sort()).toEqual(['PreToolUse', 'Stop'])
  })
})
