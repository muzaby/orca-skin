import { describe, expect, it, vi } from 'vitest'
import {
  beginConnect,
  buildConnectOptions,
  classifyConnectFailure,
  completeConnect,
  connectorOriginDisplay,
  connectorTarget,
  type ConnectApi
} from './connectorConnect'
import type {
  AuthBindingInfo,
  AuthProviderInfo,
  AuthStepInfo,
  PluginConnectorInfo
} from '../../../../../shared/ipc'

const CONNECTOR: PluginConnectorInfo = {
  connectorId: 'confluence-dc',
  label: 'Confluence',
  origin: 'https://wiki.corp',
  pluginId: 'confluence',
  acceptedAuthProviders: ['confluence-pat', 'confluence-basic'],
  connected: false,
  source: 'static'
}

function provider(id: string, overrides: Partial<AuthProviderInfo> = {}): AuthProviderInfo {
  return {
    id,
    pluginId: 'confluence',
    apiVersion: 1,
    label: id,
    targets: ['connector'],
    mechanisms: ['personal_access_token'],
    capabilities: ['logout'],
    ...overrides
  }
}

describe('buildConnectOptions', () => {
  it('수용 provider 교집합으로 방식 목록을 만든다', () => {
    const result = buildConnectOptions(CONNECTOR, [
      provider('confluence-pat', { label: 'PAT' }),
      provider('confluence-basic', { label: 'ID/비밀번호', mechanisms: ['basic'] }),
      // 이 connector 가 수용하지 않는 provider 는 목록에 없다.
      provider('other-sso', { label: 'SSO' })
    ])
    expect(result.options).toEqual([
      { providerId: 'confluence-pat', label: 'PAT', mechanism: 'personal_access_token' },
      { providerId: 'confluence-basic', label: 'ID/비밀번호', mechanism: 'basic' }
    ])
    expect(result.unavailableReason).toBeNull()
  })

  it('등록되지 않은 provider 는 제외한다', () => {
    // 선언만 보고 버튼을 그리면 누르는 순간 begin 이 실패한다.
    const result = buildConnectOptions(CONNECTOR, [provider('confluence-pat')])
    expect(result.options.map((o) => o.providerId)).toEqual(['confluence-pat'])
  })

  it('connector target 을 지원하지 않는 provider 를 제외한다', () => {
    const result = buildConnectOptions(CONNECTOR, [
      provider('confluence-pat', { targets: ['application'] })
    ])
    expect(result.options).toEqual([])
    expect(result.unavailableReason).toBe('no_matching_provider')
  })

  it('교집합이 비면 연결 불가를 낸다', () => {
    const result = buildConnectOptions(CONNECTOR, [])
    expect(result.options).toEqual([])
    expect(result.unavailableReason).toBe('no_matching_provider')
  })
})

describe('connectorOriginDisplay', () => {
  it('주소는 표시값이고 입력 필드가 아니다', () => {
    // base url 은 코드 레벨에서 온다(사용자 결정) — 모달에 입력 표면이 없다.
    expect(connectorOriginDisplay(CONNECTOR)).toBe('https://wiki.corp')
  })
})

describe('classifyConnectFailure', () => {
  it('connect reject 메시지를 사유로 분류한다', () => {
    expect(classifyConnectFailure(new Error('connector already connected: x'))).toBe(
      'already_connected'
    )
    expect(classifyConnectFailure(new Error('자격증명이 거부되었습니다'))).toBe(
      'invalid_credentials'
    )
    expect(classifyConnectFailure(new Error('Confluence 서버에 연결하지 못했습니다'))).toBe(
      'unreachable'
    )
    expect(classifyConnectFailure(new Error('connector is not ready: x'))).toBe('unreachable')
    expect(classifyConnectFailure(new Error('무슨 일이 났다'))).toBe('unknown')
  })

  it('Error 가 아닌 값도 처리한다', () => {
    expect(classifyConnectFailure('already connected')).toBe('already_connected')
    expect(classifyConnectFailure(undefined)).toBe('unknown')
  })
})

describe('connectorTarget', () => {
  it('connector target 을 만든다', () => {
    expect(connectorTarget('confluence-dc', 'uuid-1')).toEqual({
      kind: 'connector',
      connectorId: 'confluence-dc',
      connectionId: 'uuid-1'
    })
  })
})

function stepCollect(): AuthStepInfo {
  return {
    kind: 'collect',
    transactionId: 'tx-1',
    fields: [{ name: 'credential', label: 'PAT', type: 'password', required: true }]
  }
}

function stepDone(): AuthStepInfo {
  const binding: AuthBindingInfo = {
    id: 'bind-1',
    pluginId: 'confluence',
    providerId: 'confluence-pat',
    target: { kind: 'connector', connectorId: 'confluence-dc', connectionId: 'uuid-1' },
    mechanism: 'personal_access_token',
    artifact: {
      kind: 'vault_credential',
      handleId: 'secret',
      credentialKind: 'personal_access_token'
    },
    status: 'valid',
    createdAt: 0
  }
  return { kind: 'done', binding }
}

function api(overrides: Partial<ConnectApi> = {}): ConnectApi {
  return {
    begin: vi.fn(async () => stepCollect()),
    continueAuth: vi.fn(async () => stepDone()),
    connect: vi.fn(async () => undefined),
    ...overrides
  }
}

describe('beginConnect', () => {
  it('필드 선언을 그대로 넘긴다', async () => {
    const double = api()
    const result = await beginConnect(double, 'confluence-pat', 'confluence-dc', 'uuid-1')
    expect(result.kind).toBe('collect')
    expect(result.transactionId).toBe('tx-1')
    expect(result.fields?.map((f) => f.name)).toEqual(['credential'])
    expect(double.begin).toHaveBeenCalledWith('confluence-pat', {
      kind: 'connector',
      connectorId: 'confluence-dc',
      connectionId: 'uuid-1'
    })
  })

  it('provider 가 곧바로 실패하면 실패로 전한다', async () => {
    const double = api({
      begin: async () => ({ kind: 'failed', reason: 'invalid_input', message: '안 됨' })
    })
    const result = await beginConnect(double, 'p', 'c', 'u')
    expect(result).toEqual({ kind: 'failed', message: '안 됨' })
  })

  it('이번 범위 밖 플로우(browser)는 조용히 성공시키지 않는다', async () => {
    const double = api({ begin: async () => ({ kind: 'browser', transactionId: 'tx' }) })
    expect((await beginConnect(double, 'p', 'c', 'u')).kind).toBe('failed')
  })
})

describe('completeConnect', () => {
  it('연결 액션이 pluginApi 를 호출한다', async () => {
    // binding 만 만들고 connect 를 안 하면 도구가 노출되지 않는다 — 두 호출이 한 단위다.
    const double = api()
    const result = await completeConnect(double, 'confluence-dc', 'tx-1', { credential: 'x' })

    expect(result).toEqual({ ok: true })
    expect(double.continueAuth).toHaveBeenCalledWith('tx-1', { credential: 'x' })
    expect(double.connect).toHaveBeenCalledWith('confluence-dc', 'bind-1')
  })

  it('자격증명 거부를 사유로 돌려준다', async () => {
    const double = api({
      continueAuth: async () => ({
        kind: 'failed',
        reason: 'invalid_credentials',
        message: '거부됨'
      })
    })
    const result = await completeConnect(double, 'confluence-dc', 'tx-1', {})
    expect(result).toEqual({ ok: false, failure: 'invalid_credentials', message: '거부됨' })
    // binding 이 없으므로 connect 를 부르지 않는다.
    expect(double.connect).not.toHaveBeenCalled()
  })

  it('connect 실패를 분류해 돌려준다', async () => {
    const double = api({
      connect: async () => {
        throw new Error('connector is not ready: 연결하지 못했습니다')
      }
    })
    const result = await completeConnect(double, 'confluence-dc', 'tx-1', {})
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.failure).toBe('unreachable')
  })

  it('이미 연결된 connector 를 구분한다', async () => {
    const double = api({
      connect: async () => {
        throw new Error('connector already connected: confluence-dc')
      }
    })
    const result = await completeConnect(double, 'confluence-dc', 'tx-1', {})
    if (result.ok) throw new Error('unreachable')
    expect(result.failure).toBe('already_connected')
  })
})
