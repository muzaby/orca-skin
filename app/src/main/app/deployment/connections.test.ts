import { describe, expect, it } from 'vitest'
import type { AuthSnapshot, BoundAuth } from '../../contracts/auth'
import { DEFAULT_PROVIDER_CATALOG_ICON } from '../../../shared/provider-catalog'
import { createConnectionSources, gateRows, harnessRows, usageRows } from './connections'

function auth(authId: string): BoundAuth {
  const snapshot: AuthSnapshot = {
    authId,
    status: 'none',
    verified: false,
    credentialRevision: 0
  }
  return {
    authId,
    snapshot: () => snapshot,
    request: () => Promise.reject(new Error('not used'))
  }
}

const catalog = {
  icon: 'language' as const,
  title: { ko: '연결 제목', en: 'Connection title' },
  body: { ko: '연결 본문', en: 'Connection body' }
}

describe('connection deployment presentation input', () => {
  it('gate·harness·usage row가 input을 한 번 정규화해 source에 싣는다', () => {
    const [gate] = gateRows([auth('gate')], catalog)
    const [harness] = harnessRows([
      { auth: auth('harness'), harnessModelProviderKey: 'claude-corp', catalog }
    ])
    const [usage] = usageRows([{ auth: auth('usage'), catalog }])

    expect(gate).toMatchObject({ category: 'gate', catalog })
    expect(harness).toMatchObject({ category: 'harness', catalog })
    expect(usage).toMatchObject({ category: 'usage', catalog })
  })

  it('input이 없으면 기존 fallback을 위해 catalog field를 만들지 않는다', () => {
    expect(gateRows([auth('gate')])[0]).toEqual({ category: 'gate', auth: expect.any(Object) })
    expect(
      harnessRows([{ auth: auth('harness'), harnessModelProviderKey: 'claude-corp' }])[0]
    ).not.toHaveProperty('catalog')
    expect(usageRows([{ auth: auth('usage') }])[0]).not.toHaveProperty('catalog')
  })

  it('icon 없는 input도 공용 normalizer의 기본 icon으로 정규화한다', () => {
    const titleOnly = { title: { ko: '제목', en: 'Title' } }
    const [gate] = gateRows([auth('gate')], titleOnly)
    const [harness] = harnessRows([
      { auth: auth('harness'), harnessModelProviderKey: 'claude-corp', catalog: titleOnly }
    ])
    const [usage] = usageRows([{ auth: auth('usage'), catalog: titleOnly }])
    for (const row of [gate, harness, usage]) {
      expect(row.catalog).toEqual({ icon: DEFAULT_PROVIDER_CATALOG_ICON, ...titleOnly })
    }
  })

  it('정규화 검증을 건너뛰지 않는다 — 빈 locale 입력은 row 조립에서 거부된다', () => {
    const invalid = { title: { ko: ' ', en: 'Title' } }
    expect(() => gateRows([auth('gate')], invalid)).toThrow('title.ko')
    expect(() =>
      harnessRows([
        { auth: auth('harness'), harnessModelProviderKey: 'claude-corp', catalog: invalid }
      ])
    ).toThrow('title.ko')
    expect(() => usageRows([{ auth: auth('usage'), catalog: invalid }])).toThrow('title.ko')
  })

  it('기본 factory는 gate·plugin row만 만든다', () => {
    const sources = createConnectionSources({
      auth: { bind: (id) => auth(id) },
      gateMembers: [auth('gate')],
      plugins: []
    })
    expect(sources.map((source) => source.category)).toEqual(['gate'])
    expect(sources[0]).not.toHaveProperty('catalog')
  })
})
