// 인스턴스 수명주기 (0161). registry·host 를 fake 로 주입해 순수 단위로 돌린다.
//
// 가장 중요한 검증은 **삭제 순서**다 — 연결을 먼저 끊지 않고 등록을 해제하면 도구 서버가
// 살아남아 "목록에는 없는데 모델은 계속 부를 수 있는" 상태가 된다.

import { describe, expect, it, vi } from 'vitest'
import {
  ConnectorInstanceLifecycle,
  type InstanceHostPort,
  type InstanceRegistryPort
} from './instance-lifecycle'
import { ConnectorInstanceStore, type InstancePersistPort } from './instance-store'
import { ConnectorTemplateRegistry } from './templates'
import type { ConnectorTemplate } from '../../contracts/connector-template'

function memoryPort(initial: unknown = []): InstancePersistPort {
  let raw = initial
  return {
    read: () => raw,
    write: (instances) => {
      raw = JSON.parse(JSON.stringify(instances))
    }
  }
}

function fakeTemplate(id = 'confluence'): ConnectorTemplate {
  return {
    id,
    i18nKey: `skills.templates.${id}`,
    fields: [{ name: 'baseUrl', required: true, i18nKey: 'x' }],
    sharedPackage: () => ({ manifest: { id, kind: 'shared' }, providers: [{ p: 1 }] }),
    instancePackage: (config) => ({
      manifest: { id: config.connectorId, kind: 'instance' },
      connectors: [{ c: config.connectorId }],
      runtimeTools: [{ t: config.connectorId }]
    })
  }
}

interface Harness {
  lifecycle: ConnectorInstanceLifecycle
  store: ConnectorInstanceStore
  registered: unknown[]
  unregistered: string[]
  disconnected: string[]
  order: string[]
}

function harness(
  opts: {
    persist?: InstancePersistPort
    registerErrors?: () => Array<{ message: string }>
    // 정적 등록이 이미 올린 pluginId (0164).
    alreadyRegistered?: readonly string[]
  } = {}
): Harness {
  const registered: unknown[] = []
  const unregistered: string[] = []
  const disconnected: string[] = []
  const order: string[] = []

  const registry: InstanceRegistryPort = {
    hasPlugin: (pluginId) => (opts.alreadyRegistered ?? []).includes(pluginId),
    register: (input) => {
      const errors = opts.registerErrors?.() ?? []
      if (errors.length === 0) registered.push(input.manifest)
      order.push('register')
      return errors
    },
    unregister: (pluginId) => {
      unregistered.push(pluginId)
      order.push('unregister')
      return true
    }
  }
  const host: InstanceHostPort = {
    disconnectIfConnected: async (connectorId) => {
      disconnected.push(connectorId)
      order.push('disconnect')
    }
  }
  const store = new ConnectorInstanceStore(opts.persist ?? memoryPort())
  const lifecycle = new ConnectorInstanceLifecycle({
    store,
    templates: new ConnectorTemplateRegistry([fakeTemplate()]),
    registry,
    host
  })
  return { lifecycle, store, registered, unregistered, disconnected, order }
}

const INPUT = { templateId: 'confluence', label: '위키', baseUrl: 'https://wiki.corp' }

describe('ConnectorInstanceLifecycle — 생성', () => {
  it('저장하고 등록한다', async () => {
    const h = harness()
    const result = await h.lifecycle.create(INPUT)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.instance.connectorId).toBe('confluence-wiki-corp')
    expect(h.store.list()).toHaveLength(1)
    expect(h.registered).toEqual([{ id: 'confluence-wiki-corp', kind: 'instance' }])
  })

  it('알 수 없는 템플릿을 거부하고 저장하지 않는다', async () => {
    const h = harness()
    const result = await h.lifecycle.create({ ...INPUT, templateId: 'nope' })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('unknown_template')
    expect(h.store.list()).toEqual([])
    expect(h.registered).toEqual([])
  })

  it('중복 생성을 거부한다', async () => {
    const h = harness()
    await h.lifecycle.create(INPUT)
    const second = await h.lifecycle.create(INPUT)
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('unreachable')
    expect(second.reason).toBe('already_exists')
  })

  it('등록 실패 시 저장을 되돌린다', async () => {
    // 유령 인스턴스를 남기면 재시작 때 같은 실패를 반복할 뿐이다.
    const h = harness({ registerErrors: () => [{ message: 'boom' }] })
    const result = await h.lifecycle.create(INPUT)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('register_failed')
    expect(h.store.list()).toEqual([])
  })
})

describe('ConnectorInstanceLifecycle — 삭제', () => {
  it('연결 → 등록 해제 → 저장소 순서로 지운다', async () => {
    const h = harness()
    await h.lifecycle.create(INPUT)
    h.order.length = 0

    const result = await h.lifecycle.remove('confluence-wiki-corp')
    expect(result.ok).toBe(true)
    // 순서가 뒤집히면 도구 서버가 살아남는다.
    expect(h.order).toEqual(['disconnect', 'unregister'])
    expect(h.disconnected).toEqual(['confluence-wiki-corp'])
    expect(h.unregistered).toEqual(['confluence-wiki-corp'])
    expect(h.store.list()).toEqual([])
  })

  it('정적 connector 삭제를 거부한다', async () => {
    // 저장소에 없는 connector = 코드로 배포된 정적 connector. UI 에서 지울 수 없다.
    const h = harness()
    const result = await h.lifecycle.remove('confluence-static')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('not_found')
    // 아무것도 건드리지 않는다.
    expect(h.disconnected).toEqual([])
    expect(h.unregistered).toEqual([])
  })

  it('삭제 후 같은 주소로 다시 만들 수 있다', async () => {
    const h = harness()
    await h.lifecycle.create(INPUT)
    await h.lifecycle.remove('confluence-wiki-corp')
    expect((await h.lifecycle.create(INPUT)).ok).toBe(true)
  })
})

describe('ConnectorInstanceLifecycle — 복원', () => {
  it('공용 패키지를 인스턴스보다 먼저 등록한다', () => {
    // 인스턴스 connector 가 공용 provider 를 참조하므로 순서가 뒤집히면 참조 실패가 난다.
    const persist = memoryPort([
      {
        connectorId: 'confluence-a',
        templateId: 'confluence',
        label: 'A',
        baseUrl: 'https://a.corp'
      }
    ])
    const h = harness({ persist })
    const result = h.lifecycle.restore()

    expect(result.registered.map((i) => i.connectorId)).toEqual(['confluence-a'])
    expect(h.registered).toEqual([
      { id: 'confluence', kind: 'shared' },
      { id: 'confluence-a', kind: 'instance' }
    ])
  })

  it('알 수 없는 템플릿의 인스턴스를 건너뛰고 나머지를 복원한다', () => {
    const persist = memoryPort([
      { connectorId: 'ghost', templateId: 'gone', label: 'G', baseUrl: 'https://g.corp' },
      {
        connectorId: 'confluence-b',
        templateId: 'confluence',
        label: 'B',
        baseUrl: 'https://b.corp'
      }
    ])
    const h = harness({ persist })
    const result = h.lifecycle.restore()

    expect(result.registered.map((i) => i.connectorId)).toEqual(['confluence-b'])
    expect(result.failed.map((f) => f.instance.connectorId)).toEqual(['ghost'])
  })

  it('저장된 인스턴스가 없어도 공용 패키지는 등록한다', () => {
    const h = harness()
    const result = h.lifecycle.restore()
    expect(result.registered).toEqual([])
    expect(h.registered).toEqual([{ id: 'confluence', kind: 'shared' }])
  })

  // 0164 — 정적 등록(`AUTH_PLUGIN_PACKAGES`)이 같은 pluginId 를 먼저 올릴 수 있다. 그대로
  // 부르면 registry 가 중복으로 거부해 매 부팅 오류 로그가 남는다.
  it('공용 패키지가 이미 있으면 건너뛴다', () => {
    const h = harness({ alreadyRegistered: ['confluence'] })
    h.lifecycle.restore()
    expect(h.registered).toEqual([])
  })

  it('없으면 등록한다', () => {
    const h = harness()
    h.lifecycle.restore()
    expect(h.registered).toEqual([{ id: 'confluence', kind: 'shared' }])
  })

  it('복원 실패를 로거로 알린다', () => {
    const logger = vi.fn()
    const store = new ConnectorInstanceStore(
      memoryPort([
        { connectorId: 'ghost', templateId: 'gone', label: 'G', baseUrl: 'https://g.corp' }
      ])
    )
    new ConnectorInstanceLifecycle({
      store,
      templates: new ConnectorTemplateRegistry([fakeTemplate()]),
      registry: { register: () => [], unregister: () => true, hasPlugin: () => false },
      host: { disconnectIfConnected: async () => undefined },
      logger
    }).restore()
    expect(logger).toHaveBeenCalledWith('connector.instance.restore.partial', { failed: 1 })
  })
})

describe('ConnectorInstanceLifecycle — 출처 판정', () => {
  it('사용자 인스턴스와 정적 connector 를 구분한다', async () => {
    const h = harness()
    await h.lifecycle.create(INPUT)
    expect(h.lifecycle.isUserInstance('confluence-wiki-corp')).toBe(true)
    expect(h.lifecycle.isUserInstance('confluence-static')).toBe(false)
  })
})
