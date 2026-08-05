// binding 레코드 형상 검사 (0170) — 형상 검사가 이 어댑터의 유일한 판단이다.
// electron-store 자체는 여기서 안 돈다(레이어 경계는 `createBindingPersistence` 뒤).

import { describe, expect, it } from 'vitest'
import { parseBindingRecords } from './binding-records'

const VALID = {
  id: 'bind_1_abcd',
  pluginId: 'confluence',
  providerId: 'confluence-pat',
  target: { kind: 'connector', connectorId: 'confluence-dc', connectionId: 'conn-1' },
  mechanism: 'personal_access_token',
  artifact: { kind: 'vault_credential', handleId: 'h1', credentialKind: 'personal_access_token' },
  status: 'valid',
  createdAt: 1_700_000_000_000
}

describe('parseBindingRecords', () => {
  it('올바른 레코드를 그대로 통과시킨다', () => {
    expect(parseBindingRecords([VALID])).toEqual([VALID])
  })

  it('레코드에 비밀 값을 싣지 않는다 — 저장 형상에 값 필드가 없다', () => {
    // 저장되는 것은 handle 뿐이다. 값이 섞여 들어올 자리가 형상에 없다는 것을 고정한다.
    const [record] = parseBindingRecords([VALID])
    const serialized = JSON.stringify(record)
    expect(serialized).not.toContain('secret-value')
    // artifact 는 **handle 과 종류**만 든다 — 값이 들어갈 자리가 형상에 없다.
    expect(Object.keys(record.artifact).sort()).toEqual(['credentialKind', 'handleId', 'kind'])
    expect(record.artifact).not.toHaveProperty('value')
  })

  it('손상된 저장 내용은 빈 목록으로 강등한다', () => {
    // 파일 하나가 앱을 못 뜨게 하는 것이 최악이다.
    expect(parseBindingRecords(null)).toEqual([])
    expect(parseBindingRecords('not-an-array')).toEqual([])
    expect(parseBindingRecords({})).toEqual([])
  })

  it('형상이 어긋난 레코드만 버리고 나머지는 살린다', () => {
    const out = parseBindingRecords([
      VALID,
      null,
      { ...VALID, id: '' },
      { ...VALID, createdAt: 'yesterday' },
      { ...VALID, target: { kind: 'connector' } },
      { ...VALID, target: { kind: 'unknown' } },
      { ...VALID, artifact: null }
    ])
    expect(out).toEqual([VALID])
  })

  it('application target 레코드도 형상 검사는 통과한다 — 걸러내기는 broker 몫이다', () => {
    const app = { ...VALID, target: { kind: 'application', applicationId: 'orca' } }
    expect(parseBindingRecords([app])).toEqual([app])
  })
})
