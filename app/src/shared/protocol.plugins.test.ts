import { describe, expect, it } from 'vitest'
import {
  PluginConnectionConnectRequestSchema,
  PluginConnectionDisconnectRequestSchema,
  PluginConnectorInfoSchema,
  PluginDiagnosticSchema,
  PluginDiagnosticsRequestSchema,
  PluginListRequestSchema,
  SettingsSchema
} from './protocol'

describe('plugin IPC protocol', () => {
  it('accepts only an omitted list request payload', () => {
    expect(PluginListRequestSchema.safeParse(undefined).success).toBe(true)
    expect(PluginListRequestSchema.safeParse(null).success).toBe(false)
    expect(PluginListRequestSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a connect request with only a valid connector and opaque binding ID', () => {
    expect(
      PluginConnectionConnectRequestSchema.safeParse({
        connectorId: 'connector-one',
        bindingId: 'binding-opaque-1'
      }).success
    ).toBe(true)
  })

  it.each([
    { connectorId: 'Connector-One', bindingId: 'binding-opaque-1' },
    { connectorId: 'connector-one', bindingId: '' },
    { connectorId: 'connector-one', bindingId: 'binding-opaque-1', url: 'https://evil.invalid' },
    { connectorId: 'connector-one', bindingId: 'binding-opaque-1', alias: 'secondary' },
    { connectorId: 'connector-one', bindingId: 'binding-opaque-1', connectionId: 'chosen-by-ui' }
  ])('rejects a malformed or expanded connect request %#', (request) => {
    expect(PluginConnectionConnectRequestSchema.safeParse(request).success).toBe(false)
  })

  it('accepts a disconnect request with only a valid connector ID', () => {
    expect(
      PluginConnectionDisconnectRequestSchema.safeParse({ connectorId: 'connector-two' }).success
    ).toBe(true)
    expect(
      PluginConnectionDisconnectRequestSchema.safeParse({
        connectorId: 'connector-two',
        connectionId: 'leaked-id'
      }).success
    ).toBe(false)
  })

  it('allows only the safe connector list DTO fields', () => {
    const safe = {
      connectorId: 'connector-one',
      label: 'Connector One',
      origin: 'https://connector-one.example.invalid',
      pluginId: 'test-plugin',
      acceptedAuthProviders: ['test-provider'],
      connected: false,
      source: 'static'
    }
    expect(PluginConnectorInfoSchema.safeParse(safe).success).toBe(true)

    for (const forbidden of [
      'secret',
      'presentation',
      'artifact',
      'binding',
      'bindingId',
      'connectionId'
    ]) {
      expect(
        PluginConnectorInfoSchema.safeParse({ ...safe, [forbidden]: 'not-for-renderer' }).success
      ).toBe(false)
    }
  })
})

// 0164 — 서버 추가 버튼은 **디버그 토글 뒤**에 있다. 기본값이 true 로 뒤집히면 빌드타임 전용
// 이라던 서버 목록에 사용자가 UI 로 서버를 추가할 수 있게 된다(사용자 결정 2026-08-03).
describe('pluginAddEnabled 기본값', () => {
  it('설정을 비운 채 파싱하면 false 다', () => {
    expect(SettingsSchema.parse({}).pluginAddEnabled).toBe(false)
  })
})

// 0164 r2 — 등록 거부 사유를 renderer 로 올리는 경계. 목록이 비어 보이는 이유가 화면에 있어야 한다.
describe('plugin 진단 IPC', () => {
  it('요청 페이로드는 없어야 한다', () => {
    expect(PluginDiagnosticsRequestSchema.safeParse(undefined).success).toBe(true)
    expect(PluginDiagnosticsRequestSchema.safeParse({}).success).toBe(false)
  })

  it('세 종류의 거부만 받는다', () => {
    for (const kind of ['package', 'instance', 'cross-reference']) {
      expect(
        PluginDiagnosticSchema.safeParse({ kind, subject: 'confluence', message: '거부됨' }).success
      ).toBe(true)
    }
    expect(
      PluginDiagnosticSchema.safeParse({ kind: 'other', subject: 'x', message: 'y' }).success
    ).toBe(false)
  })

  it('알 수 없는 필드를 거부한다 — main 전용 값이 새지 않는다', () => {
    expect(
      PluginDiagnosticSchema.safeParse({
        kind: 'package',
        subject: 'confluence',
        message: '거부됨',
        secret: 'pat'
      }).success
    ).toBe(false)
  })
})
