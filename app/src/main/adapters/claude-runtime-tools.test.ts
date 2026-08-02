import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const { createSdkMcpServer } = vi.hoisted(() => ({
  createSdkMcpServer: vi.fn((options?: { name: string }) => ({ sdkName: options?.name }))
}))

vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  createSdkMcpServer
}))

import { adaptRuntimeTools } from './claude-runtime-tools'
import type { RuntimeToolSnapshot } from './runtime-tools'

const snapshot: RuntimeToolSnapshot = {
  revision: 1,
  servers: new Map([
    [
      'records',
      {
        descriptor: {
          id: 'records',
          pluginId: 'plugin-a',
          connectorId: 'connector-a',
          apiVersion: 1,
          alwaysLoad: true,
          instructions: 'Use records only for owned data.',
          tools: [
            {
              name: 'lookup',
              description: 'Find a record',
              annotations: { readOnlyHint: true }
            }
          ]
        },
        implementations: [
          {
            name: 'lookup',
            inputSchema: { query: z.string() },
            handler: async () => ({ content: [] })
          }
        ]
      }
    ]
  ])
}

describe('adaptRuntimeTools', () => {
  beforeEach(() => createSdkMcpServer.mockClear())

  it('서버 식별자를 하나로 사용한다', () => {
    expect(adaptRuntimeTools(snapshot)).toEqual({ mcpServers: { records: { sdkName: 'records' } } })
    expect(createSdkMcpServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'records',
        alwaysLoad: true,
        instructions: 'Use records only for owned data.',
        tools: [
          expect.objectContaining({
            name: 'lookup',
            description: 'Find a record',
            annotations: { readOnlyHint: true }
          })
        ]
      })
    )
  })

  it('빈 스냅샷은 빈 옵션을 반환한다', () => {
    expect(adaptRuntimeTools()).toEqual({})
    expect(adaptRuntimeTools({ revision: 0, servers: new Map() })).toEqual({})
    expect(createSdkMcpServer).not.toHaveBeenCalled()
  })
})
