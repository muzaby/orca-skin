import { describe, expect, it } from 'vitest'
import { runtimeApprovalToolNames } from './runtime-tool-policy'
import type { RuntimeToolSnapshot } from './runtime-tools'

const snapshot: RuntimeToolSnapshot = {
  revision: 4,
  servers: new Map([
    [
      'records',
      {
        descriptor: {
          id: 'records',
          pluginId: 'plugin-a',
          connectorId: 'connector-a',
          apiVersion: 1,
          tools: [
            { name: 'read', description: 'Read', annotations: { readOnlyHint: true } },
            { name: 'write', description: 'Write', annotations: { readOnlyHint: false } },
            { name: 'unspecified', description: 'Unspecified', annotations: {} },
            { name: 'undeclared', description: 'Undeclared' }
          ]
        },
        implementations: []
      }
    ]
  ])
}

describe('runtimeApprovalToolNames', () => {
  it('readOnlyHint가 true인 도구만 자동 허용하고 나머지는 완전한 SDK 이름으로 승인 대상에 넣는다', () => {
    expect(runtimeApprovalToolNames(snapshot)).toEqual(
      new Set(['mcp__records__write', 'mcp__records__unspecified', 'mcp__records__undeclared'])
    )
  })

  it('snapshot 미주입은 빈 승인 대상이다', () => {
    expect(runtimeApprovalToolNames()).toEqual(new Set())
  })
})
