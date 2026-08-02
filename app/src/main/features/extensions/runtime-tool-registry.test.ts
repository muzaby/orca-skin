import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { RuntimeToolRegistry } from './runtime-tool-registry'
import type { RuntimeToolServer } from '../../adapters/runtime-tools'

const server = (id: string): RuntimeToolServer => ({
  descriptor: {
    id,
    pluginId: 'plugin-a',
    connectorId: 'connector-a',
    apiVersion: 1,
    tools: [{ name: 'lookup', description: 'Find a record' }]
  },
  implementations: [
    {
      name: 'lookup',
      inputSchema: { query: z.string() },
      handler: async () => ({})
    }
  ]
})

describe('RuntimeToolRegistry', () => {
  it('실질 변경 때만 revision을 증가시킨다', () => {
    const registry = new RuntimeToolRegistry()
    const first = server('records')

    expect(registry.snapshot()).toMatchObject({ revision: 0 })

    registry.add(first)
    expect(registry.snapshot()).toMatchObject({ revision: 1 })

    registry.add(first)
    expect(registry.snapshot()).toMatchObject({ revision: 1 })

    registry.remove('missing')
    expect(registry.snapshot()).toMatchObject({ revision: 1 })

    registry.remove('records')
    expect(registry.snapshot()).toMatchObject({ revision: 2, servers: new Map() })
  })

  it('같은 정적 server ID의 교체는 snapshot과 revision에 반영한다', () => {
    const registry = new RuntimeToolRegistry()
    const first = server('records')
    const replacement = server('records')

    registry.add(first)
    registry.add(replacement)

    const snapshot = registry.snapshot()
    expect(snapshot.revision).toBe(2)
    expect(snapshot.servers.get('records')).toBe(replacement)
  })
})
