// Basic credential provider (0160) — ID/비밀번호 2필드.
//
// 계약 전반(5메서드·capability 정합)은 `conformance.test.ts` 가 본다. 여기서는 이 provider
// **고유의 규칙**만 본다: 두 필드 수집 · `user:pass` 봉인 · 원문 비노출 · 콜론 거부.

import { describe, expect, it } from 'vitest'
import { createFakeContext, createFakeVault } from '../conformance'
import { BINDING_SECRET_NAME } from '../broker'
import {
  BASIC_PASSWORD_FIELD,
  BASIC_USERNAME_FIELD,
  createBasicCredentialProvider
} from './basic-credential'
import type { AuthTarget } from '../../../../shared/ipc'

const TARGET: AuthTarget = { kind: 'connector', connectorId: 'wiki', connectionId: 'c1' }

function provider(): ReturnType<typeof createBasicCredentialProvider> {
  return createBasicCredentialProvider({ id: 'idpw', pluginId: 'corp', label: 'ID/비밀번호' })
}

describe('createBasicCredentialProvider — 필드 선언', () => {
  it('아이디와 비밀번호 두 필드를 요구한다', async () => {
    const step = await provider().begin(createFakeContext({ target: TARGET }))
    if (step.kind !== 'collect') throw new Error('unreachable')
    expect(step.fields.map((f) => f.name)).toEqual([BASIC_USERNAME_FIELD, BASIC_PASSWORD_FIELD])
    // 비밀번호만 마스킹된다 — 아이디는 사용자가 오타를 확인해야 한다.
    expect(step.fields.map((f) => f.type)).toEqual(['text', 'password'])
    expect(step.fields.every((f) => f.required)).toBe(true)
  })

  it('라벨을 커스터마이즈할 수 있다', async () => {
    const custom = createBasicCredentialProvider({
      id: 'idpw',
      pluginId: 'corp',
      label: 'ID/비밀번호',
      usernameLabel: '사번',
      passwordLabel: '사내 비밀번호'
    })
    const step = await custom.begin(createFakeContext({ target: TARGET }))
    if (step.kind !== 'collect') throw new Error('unreachable')
    expect(step.fields.map((f) => f.label)).toEqual(['사번', '사내 비밀번호'])
  })
})

describe('createBasicCredentialProvider — 봉인', () => {
  it('두 필드를 받아 basic credential 을 봉인한다', async () => {
    const vault = createFakeVault()
    const ctx = createFakeContext({
      target: TARGET,
      input: { [BASIC_USERNAME_FIELD]: 'alice', [BASIC_PASSWORD_FIELD]: 's3cret' },
      vault
    })
    const step = await provider().continue(ctx)

    if (step.kind !== 'done') throw new Error('unreachable')
    expect(step.binding.mechanism).toBe('basic')
    // 서버가 base64 할 대상은 `user:pass` 한 문자열이다.
    expect(vault.dump().get(BINDING_SECRET_NAME)).toBe('alice:s3cret')
    expect(vault.describe(BINDING_SECRET_NAME)?.kind).toBe('basic')
  })

  it('done step 에 원문 값이 없다', async () => {
    const ctx = createFakeContext({
      target: TARGET,
      input: { [BASIC_USERNAME_FIELD]: 'alice', [BASIC_PASSWORD_FIELD]: 'super-secret-pw' },
      vault: createFakeVault()
    })
    const step = await provider().continue(ctx)
    // 아이디는 표시용 principal 로 남지만 비밀번호는 어디에도 없다.
    expect(JSON.stringify(step)).not.toContain('super-secret-pw')
    if (step.kind !== 'done') throw new Error('unreachable')
    expect(step.binding.artifact).toEqual({
      kind: 'vault_credential',
      handleId: BINDING_SECRET_NAME,
      credentialKind: 'basic'
    })
    expect(step.binding.principal?.displayName).toBe('alice')
  })

  it('앞뒤 공백이 있는 비밀번호를 그대로 보존한다', async () => {
    const vault = createFakeVault()
    await provider().continue(
      createFakeContext({
        target: TARGET,
        input: { [BASIC_USERNAME_FIELD]: ' alice ', [BASIC_PASSWORD_FIELD]: ' pw ' },
        vault
      })
    )
    // 아이디는 trim, 비밀번호는 보존 — 공백이 유효한 비밀번호일 수 있다.
    expect(vault.dump().get(BINDING_SECRET_NAME)).toBe('alice: pw ')
  })
})

describe('createBasicCredentialProvider — 입력 거부', () => {
  it('빈 사용자명·빈 비밀번호를 거부한다', async () => {
    const cases = [
      { [BASIC_USERNAME_FIELD]: '', [BASIC_PASSWORD_FIELD]: 'pw' },
      { [BASIC_USERNAME_FIELD]: '   ', [BASIC_PASSWORD_FIELD]: 'pw' },
      { [BASIC_USERNAME_FIELD]: 'alice', [BASIC_PASSWORD_FIELD]: '' }
    ]
    for (const input of cases) {
      const vault = createFakeVault()
      const step = await provider().continue(createFakeContext({ target: TARGET, input, vault }))
      expect(step.kind).toBe('failed')
      // 거부했으면 아무것도 봉인하지 않는다.
      expect(vault.dump().size).toBe(0)
    }
  })

  it('아이디의 콜론을 거부한다', async () => {
    // `user:pass` 는 첫 `:` 를 구분자로 쓰므로, 아이디에 `:` 가 있으면 서버가 받는 사용자명이
    // 입력값과 달라진다. 조용히 잘리게 두지 않는다.
    const vault = createFakeVault()
    const step = await provider().continue(
      createFakeContext({
        target: TARGET,
        input: { [BASIC_USERNAME_FIELD]: 'ali:ce', [BASIC_PASSWORD_FIELD]: 'pw' },
        vault
      })
    )
    expect(step.kind).toBe('failed')
    if (step.kind !== 'failed') throw new Error('unreachable')
    expect(step.reason).toBe('invalid_input')
    expect(vault.dump().size).toBe(0)
  })
})

describe('createBasicCredentialProvider — 나머지 메서드', () => {
  it('refresh 는 not_supported 다 (메서드를 빼지 않는다)', async () => {
    const result = await provider().refresh(createFakeContext({ target: TARGET }), {
      id: 'b1',
      target: TARGET,
      mechanism: 'basic',
      artifact: { kind: 'vault_credential', handleId: 'secret', credentialKind: 'basic' }
    })
    expect(result).toEqual({ kind: 'not_supported' })
  })

  it('logout 은 봉인된 값을 지운다', async () => {
    const vault = createFakeVault()
    await provider().continue(
      createFakeContext({
        target: TARGET,
        input: { [BASIC_USERNAME_FIELD]: 'alice', [BASIC_PASSWORD_FIELD]: 'pw' },
        vault
      })
    )
    expect(vault.dump().size).toBe(1)

    await provider().logout(createFakeContext({ target: TARGET, vault }), {
      id: 'b1',
      target: TARGET,
      mechanism: 'basic',
      artifact: { kind: 'vault_credential', handleId: 'secret', credentialKind: 'basic' }
    })
    expect(vault.dump().size).toBe(0)
  })

  it('status 는 저장 여부만 판정한다 — 부재를 revoked 로 단정하지 않는다', async () => {
    const vault = createFakeVault()
    const empty = await provider().status(createFakeContext({ target: TARGET, vault }), {
      id: 'b1',
      target: TARGET,
      mechanism: 'basic',
      artifact: { kind: 'vault_credential', handleId: 'secret', credentialKind: 'basic' }
    })
    expect(empty).toEqual({ kind: 'status', status: 'unknown' })

    await provider().continue(
      createFakeContext({
        target: TARGET,
        input: { [BASIC_USERNAME_FIELD]: 'alice', [BASIC_PASSWORD_FIELD]: 'pw' },
        vault
      })
    )
    const stored = await provider().status(createFakeContext({ target: TARGET, vault }), {
      id: 'b1',
      target: TARGET,
      mechanism: 'basic',
      artifact: { kind: 'vault_credential', handleId: 'secret', credentialKind: 'basic' }
    })
    expect(stored).toEqual({ kind: 'status', status: 'valid' })
  })
})
