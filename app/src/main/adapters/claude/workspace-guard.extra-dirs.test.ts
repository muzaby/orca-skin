// `resolveGuardRoots` 는 IPC 를 타지 않는 호출부도 받는다 — 두 번째 강제 지점 (AC12).
//
// 상대경로를 그대로 `path.resolve` 에 넘기면 main 프로세스의 cwd 기준으로 풀려 사용자가
// 지목한 적 없는 폴더가 write 루트로 올라간다. 못 넓히는 쪽이 안전하므로 버린다.

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveGuardRoots } from './workspace-guard'

const WS = path.resolve('/tmp/ws')

describe('resolveGuardRoots — additionalDirs 절대 경로 강제', () => {
  it('절대 경로는 write/read 루트로 올라간다', () => {
    const roots = resolveGuardRoots(WS, [path.resolve('/tmp/refs')])

    expect(roots.writeRoots).toContain(path.resolve('/tmp/refs'))
    expect(roots.readRoots).toContain(path.resolve('/tmp/refs'))
  })

  it('상대 경로는 루트가 되지 않는다 — process.cwd() 기준으로 풀리지 않는다', () => {
    const roots = resolveGuardRoots(WS, ['refs', '../outside', './x'])

    expect(roots.writeRoots).not.toContain(path.resolve('refs'))
    expect(roots.writeRoots).not.toContain(path.resolve('../outside'))
    // ws + write 예외만 남는다 — 상대 원소는 한 개도 더해지지 않았다.
    expect(roots.writeRoots).toEqual(resolveGuardRoots(WS, []).writeRoots)
  })

  it('절대와 상대가 섞이면 절대만 남는다', () => {
    const roots = resolveGuardRoots(WS, ['refs', path.resolve('/tmp/keep')])

    expect(roots.writeRoots).toContain(path.resolve('/tmp/keep'))
    expect(roots.writeRoots).not.toContain(path.resolve('refs'))
  })
})

// D-019 지점3 — 이 층은 `path.resolve` **후** 판정하므로 텍스트 층이 놓치는 별칭까지 잡는다.
describe('resolveGuardRoots — 루트 거부 (정규화 후)', () => {
  it('루트는 write/read 루트가 되지 않는다', () => {
    const roots = resolveGuardRoots(WS, ['/'])

    expect(roots.writeRoots).not.toContain('/')
    expect(roots.writeRoots).toEqual(resolveGuardRoots(WS, []).writeRoots)
  })

  it('정규화하면 루트가 되는 별칭도 버린다 — 텍스트 층이 놓치는 자리', () => {
    for (const alias of ['/.', '/a/..', '/x/y/../..']) {
      expect(resolveGuardRoots(WS, [alias]).writeRoots, alias).toEqual(
        resolveGuardRoots(WS, []).writeRoots
      )
    }
  })

  it('루트가 아닌 실제 폴더는 정규화 후에도 남는다', () => {
    const roots = resolveGuardRoots(WS, ['/tmp/keep/..'])

    expect(roots.writeRoots).toContain(path.resolve('/tmp'))
  })
})

// D-021 — 앞의 세 지점이 막으므로 여기까지 루트가 오면 배선 결함이다. 조용히 통과시키면
// 가드가 켜져 있는 채로 아무것도 막지 않는다(`writeRoots[0]` 이 모든 경로의 조상이 된다).
describe('resolveGuardRoots — 루트 ws 는 실패로 표면화한다', () => {
  it.each(['/', 'C:\\', '\\\\srv\\share'])('ws 가 %s 면 throw 한다', (root) => {
    expect(() => resolveGuardRoots(root, [])).toThrow(/workspace root cannot be a filesystem root/)
  })

  it('정규화하면 루트가 되는 ws 도 throw 한다', () => {
    expect(() => resolveGuardRoots('/a/..', [])).toThrow(/filesystem root/)
  })

  it('루트가 아닌 ws 는 그대로 통과한다', () => {
    expect(resolveGuardRoots(WS, []).ws).toBe(WS)
  })

  it('**writeRoots[0] 이 루트인 상태를 만들 수 없다** — AC26 의 핵심 단언', () => {
    for (const root of ['/', '/.', '/a/..']) {
      expect(() => resolveGuardRoots(root, [])).toThrow()
    }
  })
})
