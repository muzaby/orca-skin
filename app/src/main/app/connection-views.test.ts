// 카탈로그 wire 동등성 (0188 AC22).
//
// 내부 소유자가 바뀌어도 renderer 가 받는 DTO 는 **글자까지 같아야** 한다. 이 파일이 잠그는
// 것은 "필드 하나가 조용히 빠지는" 실패 모드다 — 그러면 화면에서 principal 이나 만료가 사라진
// 채로도 테스트는 통과한다.

import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '../../shared/ipc'
import type { AuthDescriptor, AuthRuntime, AuthSnapshot, BoundAuth } from '../contracts/auth'
import type { Gate } from '../features/gate'
import {
  connectionInfo,
  connectionList,
  connectionState,
  duplicateConnectionAuthIds,
  type ConnectionViewSource
} from './connection-views'

function bound(authId: string, snapshot: Partial<AuthSnapshot> = {}): BoundAuth {
  return {
    authId,
    snapshot: () => ({
      authId,
      status: 'valid',
      verified: true,
      credentialRevision: 1,
      ...snapshot
    }),
    request: () => Promise.reject(new Error('not used'))
  }
}

function runtime(descriptors: Record<string, AuthDescriptor>): AuthRuntime {
  return {
    bind: (authId) => bound(authId),
    tryBind: (authId) => bound(authId),
    describe: (authId) => {
      const descriptor = descriptors[authId]
      if (!descriptor) throw new Error(`unknown auth: ${authId}`)
      return descriptor
    },
    currentStep: () => ({ kind: 'resuming', providerId: 'corp-sso' }),
    subscribe: () => () => undefined,
    resume: async () => undefined,
    login: () => Promise.reject(new Error('not used')),
    continue: () => Promise.reject(new Error('not used')),
    reauth: () => Promise.reject(new Error('not used')),
    revoke: () => undefined
  }
}

const DESCRIPTOR: AuthDescriptor = {
  authId: 'confluence',
  label: 'Confluence',
  origin: 'https://wiki.example.corp',
  methods: [
    {
      kind: 'pat',
      label: '개인 액세스 토큰',
      fields: [{ name: 'secret', label: 'PAT', type: 'password', required: true }]
    }
  ]
}

describe('connectionInfo — ProviderInfo 전 필드 (AC22)', () => {
  it('descriptor·snapshot·도구 이름을 기존 DTO 형상으로 접는다', () => {
    const auth = runtime({ confluence: DESCRIPTOR })
    const source: ConnectionViewSource = {
      category: 'plugin',
      auth: bound('confluence', {
        activeMethod: 'pat',
        principalId: 'me@example.corp',
        expiresAt: 1_700_000_000_000
      }),
      toolNames: () => ['mcp__confluence-tools__confluence_search']
    }

    const info = connectionInfo(auth, source)

    const expected: ProviderInfo = {
      id: 'confluence',
      label: 'Confluence',
      kind: 'service',
      origin: 'https://wiki.example.corp',
      auth: [
        {
          kind: 'pat',
          label: '개인 액세스 토큰',
          fields: [{ name: 'secret', label: 'PAT', type: 'password', required: true }]
        }
      ],
      status: 'valid',
      activeAuthKind: 'pat',
      principal: 'me@example.corp',
      expiresAt: 1_700_000_000_000,
      tools: ['mcp__confluence-tools__confluence_search']
    }
    expect(info).toEqual(expected)
  })

  it('미인증이면 principal·expiresAt 이 null 이다 — undefined 를 흘리지 않는다', () => {
    const auth = runtime({ confluence: DESCRIPTOR })
    const info = connectionInfo(auth, {
      category: 'plugin',
      auth: bound('confluence', { status: 'none', verified: false }),
      toolNames: () => []
    })

    expect(info.principal).toBeNull()
    expect(info.expiresAt).toBeNull()
    expect(info.activeAuthKind).toBeNull()
  })
})

describe('compat kind 매핑 (AC22)', () => {
  it('gate→gate · harness→llm · plugin→service · usage→service', () => {
    const descriptors = Object.fromEntries(
      ['a', 'b', 'c', 'd'].map((id) => [id, { ...DESCRIPTOR, authId: id }])
    )
    const auth = runtime(descriptors)
    const sources: ConnectionViewSource[] = [
      { category: 'gate', auth: bound('a') },
      { category: 'harness', auth: bound('b'), harnessModelProviderKey: 'claude-corp' },
      { category: 'plugin', auth: bound('c'), toolNames: () => [] },
      { category: 'usage', auth: bound('d') }
    ]

    expect(connectionList(auth, sources).map((info) => info.kind)).toEqual([
      'gate',
      'llm',
      'service',
      'service'
    ])
  })

  it('row 의 순서와 개수를 보존한다', () => {
    const descriptors = Object.fromEntries(
      ['a', 'b'].map((id) => [id, { ...DESCRIPTOR, authId: id }])
    )
    const auth = runtime(descriptors)
    const sources: ConnectionViewSource[] = [
      { category: 'gate', auth: bound('a') },
      { category: 'plugin', auth: bound('b'), toolNames: () => [] }
    ]

    expect(connectionList(auth, sources).map((info) => info.id)).toEqual(['a', 'b'])
  })

  it('harness row 는 도구를 노출하지 않는다', () => {
    const auth = runtime({ b: { ...DESCRIPTOR, authId: 'b' } })
    const info = connectionInfo(auth, {
      category: 'harness',
      auth: bound('b'),
      harnessModelProviderKey: 'claude-corp'
    })
    expect(info.tools).toEqual([])
  })
})

describe('connectionState', () => {
  it('gate 판정과 현재 step 을 함께 싣는다', () => {
    const auth = runtime({ a: { ...DESCRIPTOR, authId: 'a' } })
    const gate: Gate = { state: () => ({ required: true, passed: false, bypassed: false }) }

    const state = connectionState(auth, gate, [{ category: 'gate', auth: bound('a') }])

    expect(state.gate).toEqual({ required: true, passed: false, bypassed: false })
    expect(state.step).toEqual({ kind: 'resuming', providerId: 'corp-sso' })
    expect(state.providers).toHaveLength(1)
  })
})

describe('duplicateConnectionAuthIds', () => {
  it('하나의 Auth 를 여러 row 로 복제하면 잡는다', () => {
    const duplicates = duplicateConnectionAuthIds([
      { category: 'harness', auth: bound('corp'), harnessModelProviderKey: 'claude-corp' },
      { category: 'usage', auth: bound('corp') }
    ])
    expect(duplicates).toEqual(['corp'])
  })

  it('서로 다른 Auth 는 통과한다', () => {
    expect(
      duplicateConnectionAuthIds([
        { category: 'gate', auth: bound('a') },
        { category: 'usage', auth: bound('b') }
      ])
    ).toEqual([])
  })
})
