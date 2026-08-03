import { describe, expect, it } from 'vitest'
import {
  ConnectorInstanceStore,
  normalizeApiBasePath,
  type ConnectorInstance,
  type InstancePersistPort
} from './instance-store'

function memoryPort(initial: unknown = []): InstancePersistPort & { raw: unknown } {
  const port = {
    raw: initial,
    read: () => port.raw,
    write: (instances: readonly ConnectorInstance[]) => {
      // 디스크 왕복을 흉내내려고 직렬화한다 — 참조 공유로 통과하는 테스트를 만들지 않는다.
      port.raw = JSON.parse(JSON.stringify(instances))
    }
  }
  return port
}

const INPUT = {
  templateId: 'confluence',
  label: '사내 위키',
  baseUrl: 'https://wiki.corp'
}

describe('ConnectorInstanceStore — 생성', () => {
  it('파생 ID 로 인스턴스를 만든다', () => {
    const store = new ConnectorInstanceStore(memoryPort())
    const result = store.create(INPUT)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.instance.connectorId).toBe('confluence-wiki-corp')
    expect(result.instance.label).toBe('사내 위키')
    expect(store.list()).toHaveLength(1)
  })

  it('중복 인스턴스를 거부하고 기존 것을 보존한다', () => {
    const store = new ConnectorInstanceStore(memoryPort())
    expect(store.create({ ...INPUT, label: '첫 번째' }).ok).toBe(true)

    const second = store.create({ ...INPUT, label: '두 번째' })
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('unreachable')
    expect(second.reason).toBe('already_exists')

    // 기존 것이 그대로 남는다 — 라벨이 덮이지 않는다.
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0].label).toBe('첫 번째')
  })

  it('컨텍스트 경로가 다르면 같은 host 라도 공존한다', () => {
    const store = new ConnectorInstanceStore(memoryPort())
    expect(store.create(INPUT).ok).toBe(true)
    expect(store.create({ ...INPUT, apiBasePath: '/confluence' }).ok).toBe(true)
    expect(store.list().map((i) => i.connectorId)).toEqual([
      'confluence-wiki-corp',
      'confluence-wiki-corp-confluence'
    ])
  })

  it('경로·쿼리·자격증명·비 http(s) baseUrl 을 거부한다', () => {
    const store = new ConnectorInstanceStore(memoryPort())
    const bad = [
      'https://wiki.corp/confluence',
      'https://wiki.corp?a=1',
      'https://wiki.corp#x',
      'https://user:pw@wiki.corp',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'wiki.corp',
      ''
    ]
    for (const baseUrl of bad) {
      const result = store.create({ ...INPUT, baseUrl })
      expect(result.ok, baseUrl).toBe(false)
    }
    expect(store.list()).toEqual([])
  })

  it('빈 라벨을 거부한다', () => {
    const store = new ConnectorInstanceStore(memoryPort())
    expect(store.create({ ...INPUT, label: '   ' }).ok).toBe(false)
  })

  it('컨텍스트 경로를 정규화해 저장한다', () => {
    const store = new ConnectorInstanceStore(memoryPort())
    const result = store.create({ ...INPUT, apiBasePath: 'confluence/' })
    if (!result.ok) throw new Error('unreachable')
    expect(result.instance.apiBasePath).toBe('/confluence')
  })
})

describe('ConnectorInstanceStore — 복원', () => {
  it('저장한 인스턴스를 새 스토어에서 읽는다', () => {
    const port = memoryPort()
    new ConnectorInstanceStore(port).create(INPUT)

    // 앱 재시작을 흉내낸다 — 같은 디스크 내용으로 새 인스턴스를 만든다.
    const restored = new ConnectorInstanceStore(port).list()
    expect(restored).toHaveLength(1)
    expect(restored[0]).toEqual({
      connectorId: 'confluence-wiki-corp',
      templateId: 'confluence',
      label: '사내 위키',
      baseUrl: 'https://wiki.corp'
    })
  })

  it('깨진 항목을 버리고 정상 항목을 살린다', () => {
    // 설정 파일은 사람이 편집할 수 있다 — 한 항목이 부팅 전체를 막으면 안 된다.
    const port = memoryPort([
      {
        connectorId: 'confluence-a',
        templateId: 'confluence',
        label: 'A',
        baseUrl: 'https://a.corp'
      },
      { connectorId: 'broken', templateId: 'confluence', label: 'B', baseUrl: 'not-a-url' },
      null,
      'garbage',
      {
        connectorId: 'confluence-c',
        templateId: 'confluence',
        label: 'C',
        baseUrl: 'https://c.corp'
      }
    ])
    const list = new ConnectorInstanceStore(port).list()
    expect(list.map((i) => i.connectorId)).toEqual(['confluence-a', 'confluence-c'])
  })

  it('배열이 아닌 저장값은 빈 목록이 된다', () => {
    for (const raw of [undefined, null, {}, 'x', 42]) {
      expect(new ConnectorInstanceStore(memoryPort(raw)).list()).toEqual([])
    }
  })
})

describe('ConnectorInstanceStore — 삭제', () => {
  it('삭제가 영속 목록에서 지운다', () => {
    const port = memoryPort()
    const store = new ConnectorInstanceStore(port)
    store.create(INPUT)
    store.create({ ...INPUT, baseUrl: 'https://other.corp' })

    expect(store.remove('confluence-wiki-corp')).toBe(true)
    expect(store.list().map((i) => i.connectorId)).toEqual(['confluence-other-corp'])
    // 새 스토어에서도 지워진 채로 보인다.
    expect(new ConnectorInstanceStore(port).list()).toHaveLength(1)
  })

  it('없는 ID 삭제는 false 를 주고 목록을 바꾸지 않는다', () => {
    const store = new ConnectorInstanceStore(memoryPort())
    store.create(INPUT)
    expect(store.remove('nope')).toBe(false)
    expect(store.list()).toHaveLength(1)
  })

  it('삭제 후 같은 주소로 다시 만들 수 있다', () => {
    const store = new ConnectorInstanceStore(memoryPort())
    store.create(INPUT)
    store.remove('confluence-wiki-corp')
    expect(store.create(INPUT).ok).toBe(true)
  })
})

describe('normalizeApiBasePath', () => {
  it('앞 슬래시를 붙이고 뒤 슬래시를 뗀다', () => {
    expect(normalizeApiBasePath('confluence')).toBe('/confluence')
    expect(normalizeApiBasePath('/confluence/')).toBe('/confluence')
    expect(normalizeApiBasePath('/a/b//')).toBe('/a/b')
  })

  it('빈 값과 루트는 undefined 다', () => {
    expect(normalizeApiBasePath(undefined)).toBeUndefined()
    expect(normalizeApiBasePath('')).toBeUndefined()
    expect(normalizeApiBasePath('  ')).toBeUndefined()
    expect(normalizeApiBasePath('/')).toBeUndefined()
  })
})

describe('ConnectorInstanceStore — 비밀 미보관', () => {
  it('저장 형상에 자격증명 필드가 없다', () => {
    const port = memoryPort()
    const store = new ConnectorInstanceStore(port)
    store.create(INPUT)
    // 설정 파일에는 origin·라벨 등 비밀 아닌 값만 들어간다(AUTH-PLAT-008).
    const serialized = JSON.stringify(port.raw)
    for (const forbidden of ['password', 'secret', 'token', 'credential']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden)
    }
  })
})
