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
    expect(source.match(/registerDiffPeekBodyRequest\(/g)).toHaveLength(1)
    expect(source.match(/handleDiffPeekBodyResult\(/g)).toHaveLength(1)
  })
})
