import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { GitDiffFileContent } from '../../../../../../shared/ipc'
import {
  handleDiffPeekBodyResult,
  registerDiffPeekBodyRequest,
  type DiffPeekBodyBridge
} from './diffRequirementBridge'

const request = { key: 'body-key', generation: 3 }

describe('DiffTileContent diff requirement body bridge', () => {
  it('registers and reanchors from a fresh text body callback with captured identity', () => {
    const bridge: DiffPeekBodyBridge = {
      setBody: vi.fn(),
      setDiffRequirementBodyRequest: vi.fn(),
      reanchorDiffRequirements: vi.fn()
    }
    const content: GitDiffFileContent = {
      kind: 'text',
      oldValue: 'before\nkeep\n',
      newValue: 'before\nadded\nkeep\n',
      truncated: false
    }

    registerDiffPeekBodyRequest({
      bridge,
      sessionKey: 'slot-a',
      sessionId: 'session-a',
      path: 'src/a.ts',
      request
    })
    handleDiffPeekBodyResult({
      bridge,
      sessionKey: 'slot-a',
      sessionId: 'session-a',
      path: 'src/a.ts',
      request,
      content
    })

    expect(bridge.setDiffRequirementBodyRequest).toHaveBeenCalledWith(
      'slot-a',
      'session-a',
      'src/a.ts',
      request
    )
    expect(bridge.setBody).toHaveBeenCalledWith({ ...request, content })
    expect(bridge.reanchorDiffRequirements).toHaveBeenCalledWith(
      'slot-a',
      'session-a',
      'src/a.ts',
      request,
      expect.arrayContaining([
        expect.objectContaining({ type: 'added', oldLine: null, newLine: 2, text: 'added' })
      ])
    )
  })

  it('unavailable/error bodies update local body state without mutating requirement anchors', () => {
    const bridge: DiffPeekBodyBridge = {
      setBody: vi.fn(),
      setDiffRequirementBodyRequest: vi.fn(),
      reanchorDiffRequirements: vi.fn()
    }
    const content: GitDiffFileContent = { kind: 'unavailable', reason: 'error' }

    handleDiffPeekBodyResult({
      bridge,
      sessionKey: 'slot-a',
      sessionId: 'session-a',
      path: 'src/a.ts',
      request,
      content
    })

    expect(bridge.setBody).toHaveBeenCalledWith({ ...request, content })
    expect(bridge.reanchorDiffRequirements).not.toHaveBeenCalled()
  })

  it('DiffTileContent effect invokes the production bridge helpers', () => {
    const source = readFileSync(fileURLToPath(import.meta.url).replace('.bridge.test.ts', '.tsx'), {
      encoding: 'utf8'
    })

    expect(source).toContain("from './diffRequirementBridge'")
    // 0211 ΔV3 — 본문이 오는 길이 **둘**이 됐다(캐시 적중 · 조회 응답). 둘 다 같은 production
    // helper 를 지나야 한다 — 한쪽이 지역 재구현으로 갈라지면 다시 연 파일의 요구사항만
    // 위치를 잃는다(§10 EP-23 ②). 개수를 못박지 않고 **두 경로가 모두 있다**를 센다.
    expect(source.match(/registerDiffPeekBodyRequest\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(source.match(/handleDiffPeekBodyResult\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    // 조회 경로는 응답을 캐시에 남기고, 캐시 경로는 조회를 부르지 않는다.
    expect(source).toContain('chatActions.recordDiffBody(')
    expect(source).toContain('if (cachedContent !== null) {')
  })
})
