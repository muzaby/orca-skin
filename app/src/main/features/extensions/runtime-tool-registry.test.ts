import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { RuntimeToolRegistry } from './runtime-tool-registry'
import type { RuntimeToolServer } from '../../adapters/runtime-tools'

const server = (id: string): RuntimeToolServer => ({
  descriptor: {
    id,
    connectorId: 'connector-a',
    tools: [{ name: 'lookup', description: 'Find a record' }]
  },
  implementations: [
    {
      name: 'lookup',
      inputSchema: { query: z.string() },
      handler: async () => ({ content: [] })
    }
  ]
})

const mutableServer = (id: string): RuntimeToolServer => ({
  descriptor: {
    id,
    connectorId: 'connector-a',
    tools: [
      {
        name: 'change',
        description: 'Change a record',
        annotations: { readOnlyHint: false }
      }
    ]
  },
  implementations: [
    {
      name: 'change',
      inputSchema: { value: z.string() },
      handler: async () => ({ content: [] })
    }
  ]
})

describe('RuntimeToolRegistry', () => {
  // 0180 AC5 — 인증·커넥터 스택이 사라져 기여자가 0 이다. 포트와 어댑터 배선은 남으므로,
  // 기여자 0 상태가 **정상 동작**(빈 스냅샷 + 등록/해제 왕복)임을 고정한다. 0181 의
  // `Provider.tools` 가 다시 채운다.
  it('기여자가 없으면 빈 스냅샷을 낸다', () => {
    const registry = new RuntimeToolRegistry()
    expect(registry.snapshot()).toMatchObject({ revision: 0, servers: new Map() })
  })

  it('기여자 0 에서 시작해도 등록·해제가 왕복한다', () => {
    const registry = new RuntimeToolRegistry()
    expect(registry.snapshot().servers.size).toBe(0)

    registry.add(server('records'))
    expect(registry.snapshot().servers.size).toBe(1)

    registry.remove('records')
    expect(registry.snapshot()).toMatchObject({ revision: 2, servers: new Map() })
  })

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
    expect(snapshot.servers.get('records')).toStrictEqual(replacement)
    expect(snapshot.servers.get('records')).not.toBe(replacement)
  })

  it('add 뒤 호출자의 descriptor와 implementation 변조가 registry에 새지 않는다', () => {
    const registry = new RuntimeToolRegistry()
    const input = mutableServer('records')
    const originalHandler = input.implementations[0].handler
    const originalSchema = input.implementations[0].inputSchema

    registry.add(input)
    input.descriptor.tools[0].description = 'Mutated description'
    input.descriptor.tools[0].annotations = { readOnlyHint: true }
    input.implementations[0].name = 'mutated'

    const stored = registry.snapshot().servers.get('records')!
    expect(stored.descriptor.tools[0]).toEqual({
      name: 'change',
      description: 'Change a record',
      annotations: { readOnlyHint: false }
    })
    expect(stored.implementations[0]).toMatchObject({ name: 'change', inputSchema: originalSchema })
    expect(stored.implementations[0].handler).toBe(originalHandler)
    expect(registry.snapshot().revision).toBe(1)
  })

  it('snapshot 소비자의 descriptor와 implementation 변조가 다음 snapshot에 새지 않는다', () => {
    const registry = new RuntimeToolRegistry()
    registry.add(mutableServer('records'))

    const exposed = registry.snapshot().servers.get('records')!
    exposed.descriptor.tools[0].description = 'Mutated description'
    exposed.descriptor.tools[0].annotations = { readOnlyHint: true }
    exposed.implementations[0].name = 'mutated'

    const later = registry.snapshot().servers.get('records')!
    expect(later.descriptor.tools[0]).toEqual({
      name: 'change',
      description: 'Change a record',
      annotations: { readOnlyHint: false }
    })
    expect(later.implementations[0].name).toBe('change')
    expect(registry.snapshot().revision).toBe(1)
  })
})
