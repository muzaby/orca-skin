// auth 상태 매핑 (0172) — store 에서 떼어낸 순수 변환이라 IPC 배선 없이 규칙만 검증한다.

import { describe, expect, it } from 'vitest'
import { platformStatePatch, stepPatch } from './state-mapping'
import type { AuthPlatformState, AuthProviderInfo, AuthStepInfo } from '../../../../shared/ipc'

function providerInfo(id: string, targets: AuthProviderInfo['targets']): AuthProviderInfo {
  return {
    id,
    pluginId: 'corp',
    apiVersion: 1,
    label: id.toUpperCase(),
    targets,
    mechanisms: ['personal_access_token'],
    capabilities: []
  }
}

function platformState(step: AuthStepInfo | null): AuthPlatformState {
  return {
    required: true,
    authenticated: false,
    inflight: false,
    identity: null,
    errorMessage: null,
    step,
    providers: [providerInfo('conn', ['connector']), providerInfo('app', ['application'])]
  }
}

const COLLECT: AuthStepInfo = {
  kind: 'collect',
  transactionId: 'tx_1',
  fields: [{ name: 'credential', label: '자격증명', type: 'password', required: true }]
}

describe('auth state-mapping', () => {
  it('체인 진행 정보를 그대로 노출한다', () => {
    const patch = stepPatch({ ...COLLECT, chain: { index: 2, total: 2, label: 'TWO' } })
    expect(patch.chain).toEqual({ index: 2, total: 2, label: 'TWO' })
    expect(patch.transactionId).toBe('tx_1')
    expect(patch.fields).toHaveLength(1)
  })

  it('체인이 아니면 chain 은 null 이다', () => {
    expect(stepPatch(COLLECT).chain).toBeNull()
  })

  it('stepKey 는 멤버마다 달라진다 — 앞 단계 입력이 다음 폼에 남지 않게', () => {
    const first = stepPatch({ ...COLLECT, chain: { index: 1, total: 2, label: 'ONE' } })
    const second = stepPatch({ ...COLLECT, chain: { index: 2, total: 2, label: 'TWO' } })
    expect(first.stepKey).not.toBe(second.stepKey)
  })

  it('browser·device_code step 은 필드 없이 transaction 만 잇는다', () => {
    const browser = stepPatch({
      kind: 'browser',
      transactionId: 'tx_2',
      chain: { index: 1, total: 2, label: 'ONE' }
    })
    expect(browser.fields).toEqual([])
    expect(browser.transactionId).toBe('tx_2')
    expect(browser.chain).toEqual({ index: 1, total: 2, label: 'ONE' })
  })

  it('종결 step(done/failed)과 null 은 폼 상태를 비운다', () => {
    const cleared = { fields: [], transactionId: null, chain: null, stepKey: '' }
    expect(stepPatch(null)).toEqual(cleared)
    expect(stepPatch({ kind: 'failed', reason: 'invalid_credentials' })).toEqual(cleared)
  })

  it('앱 로그인 provider 는 application 을 지원하는 첫 번째다', () => {
    expect(platformStatePatch(platformState(null)).providerId).toBe('app')
  })

  it('errorMessage 는 provider 원문을 그대로 싣고 status 를 error 로 만든다', () => {
    const patch = platformStatePatch({ ...platformState(null), errorMessage: 'timeout' })
    expect(patch.status).toBe('error')
    expect(patch.errorMessage).toEqual({ raw: 'timeout' })
  })

  it('inflight 가 error 보다 우선한다', () => {
    const patch = platformStatePatch({
      ...platformState(null),
      inflight: true,
      errorMessage: 'timeout'
    })
    expect(patch.status).toBe('inflight')
  })
})
