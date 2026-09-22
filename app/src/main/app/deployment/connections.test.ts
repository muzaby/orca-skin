import { describe, expect, it } from 'vitest'
import type { AuthSnapshot, BoundAuth } from '../../contracts/auth'
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

  it('factory도 네 category row를 선택적으로 조립한다', () => {
    const gate = auth('gate')
    const harness = auth('harness')
    const usage = auth('usage')
    const sources = createConnectionSources({
      auth: { bind: (id) => auth(id) },
      gateMembers: [gate],
      plugins: [],
      gateCatalog: catalog,
      harness: [{ auth: harness, harnessModelProviderKey: 'claude-corp', catalog }],
      usage: [{ auth: usage, catalog }]
    })

    expect(sources.map((source) => source.category)).toEqual(['gate', 'harness', 'usage'])
    expect(sources.every((source) => source.catalog?.icon === 'language')).toBe(true)
  })
})
